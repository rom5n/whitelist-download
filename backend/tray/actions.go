package tray

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/adrg/xdg"
	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/browser"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/desktop"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/paths"
	"github.com/rom5n/whitelist-download/backend/startup"
	"github.com/rom5n/whitelist-download/backend/updater"
	"go.uber.org/zap"
)

const (
	forceUpdateWait = 6 * time.Minute // A bit longer than the aggregator's update timeout
	localAPITimeout = 5 * time.Second
	maxLinkSize     = 2048
)

func (t *tray) localAPI(path string) string {
	return fmt.Sprintf("http://127.0.0.1:%s%s", t.cfg.RetrieveSafe(config.Port).Port, path)
}

func (t *tray) openDashboard() {
	browser.Open(t.cfg.RetrieveSafe(config.Port).Port, true)
}

// forceUpdate triggers a configs update through the local API, the same way the dashboard does.
func (t *tray) forceUpdate() {
	if aggregator.UpdateInProgress() {
		return
	}

	ctx, cancel := context.WithTimeout(t.ctx, forceUpdateWait)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.localAPI("/api/update-configs"), nil)
	if err != nil {
		logging.Log.Error("failed to create force update request from tray", zap.Error(err))
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		logging.Log.Error("failed to trigger force update from tray", zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logging.Log.Error("force update from tray failed", zap.Int("status", resp.StatusCode))
		return
	}

	logging.Log.Info("force update triggered from tray")
}

// copyLink copies the subscription link to the clipboard and shows the result in the menu.
func (t *tray) copyLink() {
	link, err := t.fetchSubscriptionLink()
	if err == nil {
		err = desktop.CopyToClipboard(link)
	}

	if err != nil {
		logging.Log.Error("failed to copy the subscription link", zap.Error(err))
		t.flashCopy(msgCopyFailed)
		return
	}

	t.flashCopy(msgLinkCopied)
}

// fetchSubscriptionLink asks the local API for the link, so it is the one the dashboard shows.
func (t *tray) fetchSubscriptionLink() (string, error) {
	ctx, cancel := context.WithTimeout(t.ctx, localAPITimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.localAPI("/api/subscription-link"), nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to request the link: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxLinkSize))
	if err != nil {
		return "", fmt.Errorf("failed to read the link: %w", err)
	}

	link := strings.TrimSpace(string(body))
	if link == "" {
		return "", fmt.Errorf("the link is empty")
	}
	return link, nil
}

func (t *tray) toggleAutoStart() {
	enabled := !t.cfg.RetrieveSafe(config.AutoStart).AutoStart

	t.run("change autostart", func() error {
		if err := t.cfg.SetAutoStart(enabled); err != nil {
			return err
		}

		startup.Apply(t.cfg)
		return nil
	})
}

func (t *tray) toggleNotifications() {
	enabled := !t.cfg.RetrieveSafe(config.Notifications).Notifications

	t.run("change notifications", func() error { return t.cfg.SetNotifications(enabled) })
}

func (t *tray) setLanguage(language string) {
	t.run("change language", func() error { return t.cfg.SetLanguage(language) })
}

func (t *tray) configFilePath() (string, error) {
	return xdg.ConfigFile(filepath.Join("whitelist-download", "config.json"))
}

func (t *tray) configsFilePath() (string, error) {
	path, err := paths.ConfigsFile()
	if err != nil {
		// The path is still usable, the error is about migrating a legacy file
		logging.Log.Warn("failed to resolve configs path", zap.Error(err))
	}
	return path, nil
}

func logFilePath() (string, error) {
	return logging.LogPath, nil
}

// configsFileName is the name of the file with configs, as shown in the menu.
func (t *tray) configsFileName() string {
	return paths.ConfigsFileName
}

// reveal shows a file in the file manager.
func (t *tray) reveal(resolve func() (string, error)) {
	t.run("open in the file manager", func() error {
		path, err := resolve()
		if err != nil {
			return err
		}
		return desktop.Reveal(path)
	})
}

// appUpdateAction checks for an app update, or installs the found one.
func (t *tray) appUpdateAction() {
	state := t.updaterState.Get()

	switch state.Status {
	case updateChecking, updateDownloading, updateInstalling:
		return
	case updateAvailable:
		t.downloadUpdate()
	case updateError:
		if state.Version != "" {
			t.downloadUpdate()
			return
		}
		updater.CheckUpdate(t.ctx, t.cfg, t.updaterState, t.cancel)
	default:
		updater.CheckUpdate(t.ctx, t.cfg, t.updaterState, t.cancel)
	}
}

func (t *tray) downloadUpdate() {
	t.run("download update", func() error { return updater.DownloadUpdate(t.updaterState, t.cancel) })
}
