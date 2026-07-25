package http

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"github.com/goccy/go-json"
	"github.com/rom5n/whitelist-download/backend/configs_logic"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
)

func web(fileServer http.Handler, distFS fs.FS) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		_, err := fs.Stat(distFS, path)
		if os.IsNotExist(err) {
			r.URL.Path = "/"
		}

		fileServer.ServeHTTP(w, r)
	}
}

func setSubscriptionHeaders(w http.ResponseWriter, title, description string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("profile-update-interval", "1")
	w.Header().Set("subscription-userinfo", "upload=0; download=0; total=0; expire=0")
	w.Header().Set("profile-title", fmt.Sprintf("base64:%v", title))
	w.Header().Set("announce", fmt.Sprintf("base64:%v", description))
	w.Header().Set("date", time.Now().UTC().Format(http.TimeFormat))
	w.Header().Set("routing-enable", "true")
}

func subscriptionHandler(cfg *config.Config, configsCache *domain.SafeConfigsCache) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		cfgSafe := cfg.RetrieveSafe(config.SubscriptionTitle, config.DescriptionText, config.ConfigsPath)
		subscriptionTitle := cfgSafe.SubscriptionTitle
		descriptionText := cfgSafe.DescriptionText
		configsPath := cfgSafe.ConfigsPath

		offset, limit, err := getLimitForConfigs(r)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(err.Error()))
			return
		}

		title := base64.StdEncoding.EncodeToString([]byte(subscriptionTitle))
		description := base64.StdEncoding.EncodeToString([]byte(descriptionText))

		setSubscriptionHeaders(w, title, description)

		encoder := base64.NewEncoder(base64.StdEncoding, w)
		defer encoder.Close()

		addedConfigs := sendConfigsFromCache(configsCache, encoder, offset, limit)

		if addedConfigs == 0 {
			logging.Log.Info("cache missed. Loading configs from file", zap.String("filename", configsPath))
			configsFile := domain.GetFile(configsPath)
			defer configsFile.Close()
			addedConfigs = sendConfigsFromFile(configsFile, encoder, offset, limit)
		}

		logging.Log.Info("configs sent", zap.Int("amount", addedConfigs), zap.Int("offset", offset), zap.Int("limit", limit))
	}
}

func sendConfigsFromCache(configsCache *domain.SafeConfigsCache, encoder io.WriteCloser, offset int, limit int) int {
	addedConfigs := 0

	for i, text := range configsCache.Get() {
		if i < offset-1 {
			continue
		}

		encoder.Write([]byte(text))
		encoder.Write([]byte("\n"))

		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}
	}

	return addedConfigs
}

func sendConfigsFromFile(configsFile *domain.SafeFile, encoder io.WriteCloser, offset, limit int) int {
	addedConfigs := 0
	scan := bufio.NewScanner(configsFile)
	currentLine := 1

	for scan.Scan() {
		if currentLine < offset {
			currentLine++
			continue
		}

		encoder.Write(scan.Bytes())
		encoder.Write([]byte("\n"))
		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}
		currentLine++
	}

	if err := scan.Err(); err != nil {
		logging.Log.Info("failed to read config file", zap.Error(err))
	}
	return addedConfigs
}

func getLimitForConfigs(r *http.Request) (int, int, error) {
	path := strings.TrimPrefix(r.URL.Path, "/sub")
	path = strings.TrimPrefix(path, "/")

	limit := 0
	offset := 0

	if path != "" {
		var err error
		data := strings.Split(path, "-")

		limit, err = strconv.Atoi(data[0])
		if err != nil {
			logging.Log.Info("invalid limit for requested configs")
			return 0, 0, fmt.Errorf("invalid limit")
		}

		if len(data) == 2 {
			offset, err = strconv.Atoi(data[0])
			if err != nil {
				logging.Log.Info("invalid offset foe requested configs")
				return 0, 0, fmt.Errorf("invalid offset for requested configs")
			}

			limit, err = strconv.Atoi(data[1])
			if err != nil {
				logging.Log.Info("invalid limit for requested configs")
				return 0, 0, fmt.Errorf("invalid limit for requested configs")
			}
		}
	}

	if offset < 1 {
		offset = 1
	}

	return offset, limit, nil
}

func getSubscriptionLink(cfg *config.Config, ip, port string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		cfgSafe := cfg.RetrieveSafe(config.ForcedIP, config.SubscriptionPath)
		forcedIP := cfgSafe.ForcedIP
		subPath := cfgSafe.SubscriptionPath

		if forcedIP != "" {
			ip = forcedIP
		}

		subLink := fmt.Sprintf("%v://%v:%v%v", "http", ip, port, subPath+"/15")

		w.Write([]byte(subLink))
	}
}

func getStatistics(statistics *domain.Statistics) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		err := json.NewEncoder(w).Encode(statistics)
		if err != nil {
			http.Error(w, "failed to get statistics", http.StatusInternalServerError)
			return
		}
	}
}

func getConfig(cfg *config.Config) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		err := json.NewEncoder(w).Encode(cfg)
		if err != nil {
			http.Error(w, "failed to get config", http.StatusInternalServerError)
			return
		}
	}
}

func setConfig(cfg *config.Config) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		newConfig := &config.Config{}
		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			http.Error(w, "failed to decode config", http.StatusInternalServerError)
			return
		}
		defer r.Body.Close()

		if err := cfg.Set(newConfig); err != nil {
			http.Error(w, "failed to set config", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func restart() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		logging.Log.Info("restart called")
		if runtime.GOOS == "linux" {
			os.Exit(0)
		}

		exePath, err := os.Executable()
		if err != nil {
			logging.Log.Info("failed to get program's path while restarting", zap.Error(err))
			return
		}

		cmd := exec.Command(exePath, os.Args[1:]...)

		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err = cmd.Start()
		if err != nil {
			logging.Log.Info("failed to restart", zap.Error(err))
			return
		}

		os.Exit(0)
	}
}

func updateConfigs(cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		cfgSafe := cfg.RetrieveSafe(config.ConfigsPath, config.Sources)
		configsPath := cfgSafe.ConfigsPath
		sources := cfgSafe.Sources

		result, err := configs_logic.UpdateConfigs(configsPath, configsCache, sources, locator)
		if err != nil {
			logging.Log.Info("failed to force update configs", zap.Error(err))
			http.Error(w, "failed to force update configs", http.StatusInternalServerError)
			return
		}

		update := &domain.Statistics{LastUpdate: time.Now().Unix(), AmountConfigs: result.AmountConfigs, ConfigsByCountry: result.ConfigsByCountry}
		statistics.Set(update)

		logging.Log.Info("force update results", zap.Int("updated configs", result.AmountConfigs), zap.Int("copies skipped", result.Copies), zap.Int("Isn't working skipped", result.NotWorking))

		w.WriteHeader(http.StatusOK)
	}
}

func getLogs(path string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		file := domain.GetFile(path)
		defer file.Close()

		writer := bufio.NewWriter(w)
		reader := bufio.NewReader(file)
		if _, err := writer.ReadFrom(reader); err != nil {
			http.Error(w, "failed to read logs", http.StatusInternalServerError)
			return
		}
		if err := writer.Flush(); err != nil {
			http.Error(w, "failed to flush logs", http.StatusInternalServerError)
			return
		}
	}
}
