package updater

import (
	"context"
	"fmt"
	"github.com/goccy/go-json"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Asset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type Release struct {
	TagName string  `json:"tag_name"`
	Name    string  `json:"name"`
	Body    string  `json:"body"`
	Assets  []Asset `json:"assets"`
}

func Start(ctx context.Context, cfg *config.Config, state *domain.SafeUpdaterState, cancel context.CancelFunc) {
	checkAndApplyUpdate(ctx, cfg, state, cancel)

	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			checkAndApplyUpdate(ctx, cfg, state, cancel)
		}
	}
}

func CheckUpdate(ctx context.Context, cfg *config.Config, state *domain.SafeUpdaterState, cancel context.CancelFunc) {
	checkAndApplyUpdate(ctx, cfg, state, cancel)
}

func DownloadUpdate(state *domain.SafeUpdaterState, cancel context.CancelFunc) error {
	st := state.Get()
	if st.Status != "available" && st.Status != "error" {
		return fmt.Errorf("no update available to download")
	}

	state.SetStatus("downloading")
	state.SetProgress(0)
	err := doDownloadAndReplace(st.Version, state, cancel)
	if err != nil {
		state.SetError(err.Error())
		return err
	}
	return nil
}

func checkAndApplyUpdate(ctx context.Context, cfg *config.Config, state *domain.SafeUpdaterState, cancel context.CancelFunc) {
	if state.Get().Status == "downloading" {
		return
	}

	currentVersion, ok := ctx.Value("version").(string)
	if !ok {
		currentVersion = "1.5" // fallback
	}

	state.SetStatus("checking")

	req, err := http.NewRequest("GET", "https://api.github.com/repos/rom5n/whitelist-download/releases/latest", nil)
	if err != nil {
		state.SetError("failed to create request")
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		state.SetError("failed to check for updates")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		state.SetError(fmt.Sprintf("github api returned status %d", resp.StatusCode))
		return
	}

	var release Release
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		state.SetError("failed to parse release info")
		return
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	current := strings.TrimPrefix(currentVersion, "v")

	if latestVersion == current {
		state.SetStatus("up-to-date")
		return
	}

	isMajor, isPatch := compareVersions(current, latestVersion)

	if !isMajor && !isPatch {
		state.SetStatus("up-to-date")
		return
	}

	state.SetAvailable(latestVersion, release.Name, release.Body)

	cfgSafe := cfg.RetrieveSafe(config.AutoUpdateMajor, config.AutoUpdatePatch)

	shouldDownload := false
	if isMajor && cfgSafe.AutoUpdateMajor {
		shouldDownload = true
	} else if isPatch && cfgSafe.AutoUpdatePatch {
		shouldDownload = true
	}

	if shouldDownload {
		state.SetStatus("downloading")
		state.SetProgress(0)
		if err := doDownloadAndReplace(latestVersion, state, cancel); err != nil {
			state.SetError(err.Error())
		}
	}
}

func parseNum(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

func compareVersions(current, latest string) (isMajor, isPatch bool) {
	currParts := strings.Split(current, ".")
	latestParts := strings.Split(latest, ".")

	if len(latestParts) < 2 || len(currParts) < 2 {
		return false, false
	}

	l0, l1 := parseNum(latestParts[0]), parseNum(latestParts[1])
	c0, c1 := parseNum(currParts[0]), parseNum(currParts[1])

	if l0 > c0 {
		return true, false
	} else if l0 < c0 {
		return false, false
	}

	if l1 > c1 {
		return true, false
	} else if l1 < c1 {
		return false, false
	}

	if len(latestParts) > 2 {
		if len(currParts) <= 2 {
			return false, true
		}
		l2 := parseNum(latestParts[2])
		c2 := parseNum(currParts[2])
		if l2 > c2 {
			return false, true
		}
	}

	return false, false
}

type progressReader struct {
	io.Reader
	Total   int64
	Current int64
	State   *domain.SafeUpdaterState
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	if n > 0 {
		pr.Current += int64(n)
		if pr.Total > 0 {
			pct := int((float64(pr.Current) / float64(pr.Total)) * 100)
			pr.State.SetProgress(pct)
		}
	}
	return n, err
}

func doDownloadAndReplace(version string, state *domain.SafeUpdaterState, cancel context.CancelFunc) error {
	assetName := "wl-download-" + runtime.GOOS
	if runtime.GOOS == "darwin" {
		assetName += "-" + runtime.GOARCH
	} else if runtime.GOOS == "windows" {
		assetName += ".exe"
	}

	downloadURL := fmt.Sprintf("https://github.com/rom5n/whitelist-download/releases/download/v%s/%s", version, assetName)

	logging.Log.Info("downloading update", zap.String("url", downloadURL))

	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	exeDir := filepath.Dir(exePath)
	tempFilePath := filepath.Join(exeDir, "wl-download-update.tmp")

	out, err := os.Create(tempFilePath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, &progressReader{
		Reader: resp.Body,
		Total:  resp.ContentLength,
		State:  state,
	})
	if err != nil {
		return err
	}
	out.Close()

	state.SetStatus("installing")
	time.Sleep(3 * time.Second)

	if runtime.GOOS != "windows" {
		os.Chmod(tempFilePath, 0755)
	}

	oldPath := exePath + ".old"
	os.Remove(oldPath)
	if err := os.Rename(exePath, oldPath); err != nil {
		return fmt.Errorf("failed to rename current exe: %w", err)
	}

	if err := os.Rename(tempFilePath, exePath); err != nil {
		return fmt.Errorf("failed to move new exe: %w", err)
	}

	logging.Log.Info("update successfully installed. restarting...")

	if runtime.GOOS == "linux" {
		cancel()
		return nil
	}

	cmd := exec.Command(exePath, os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		logging.Log.Error("failed to start new process", zap.Error(err))
	}

	cancel()
	return nil
}
