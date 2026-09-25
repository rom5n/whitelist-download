package handler

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/updater"
	"go.uber.org/zap"
)

func Restart(cancel context.CancelFunc) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		logging.Log.Info("restart called")
		if runtime.GOOS == "linux" {
			cancel()
			return
		}

		exePath, err := os.Executable()
		if err != nil {
			logging.Log.Error("failed to get program's path while restarting", zap.Error(err))
			return
		}

		cmd := exec.Command(exePath, os.Args[1:]...)

		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err = cmd.Start()
		if err != nil {
			logging.Log.Error("failed to restart", zap.Error(err))
			return
		}

		cancel()
	}
}

func UpdateConfigs(ctx context.Context, cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		cfgSafe := cfg.RetrieveSafe(config.Sources, config.WorkingCheckLevel)
		sources := cfgSafe.Sources
		workingCheckLevel := cfgSafe.WorkingCheckLevel

		result, err := aggregator.UpdateConfigs(ctx, configsCache, sources, locator, workingCheckLevel)
		if err != nil {
			logging.Log.Error("failed to force update configs", zap.Error(err))
			http.Error(w, "failed to force update configs", http.StatusInternalServerError)
			return
		}

		update := &domain.Statistics{LastUpdate: time.Now().Unix(), AmountConfigs: result.AmountConfigs, ConfigsByCountry: result.ConfigsByCountry, CountryCodes: result.CountryCodes}
		statistics.Set(update)

		logging.Log.Info("force update results", zap.Int("updated configs", result.AmountConfigs), zap.Int("copies skipped", result.Copies), zap.Int("Isn't working skipped", result.NotWorking), zap.Int("working check leve", workingCheckLevel))

		w.WriteHeader(http.StatusOK)
	}
}

func Logs(path string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		file := domain.GetFile(path)
		defer file.Close()

		writer := bufio.NewWriter(w)
		reader := bufio.NewReader(file)
		if _, err := writer.ReadFrom(reader); err != nil {
			logging.Log.Error("failed to read logs", zap.Error(err))
			http.Error(w, "failed to read logs", http.StatusInternalServerError)
			return
		}
		if err := writer.Flush(); err != nil {
			logging.Log.Error("failed to flush logs", zap.Error(err))
			http.Error(w, "failed to flush logs", http.StatusInternalServerError)
			return
		}
	}
}

func UpdaterStatus(state *domain.SafeUpdaterState) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		err := json.NewEncoder(w).Encode(state.Get())
		if err != nil {
			logging.Log.Error("failed to get updater status", zap.Error(err))
			http.Error(w, "failed to get updater status", http.StatusInternalServerError)
			return
		}
	}
}

func DownloadUpdate(state *domain.SafeUpdaterState, cancel context.CancelFunc) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		go func() {
			if err := updater.DownloadUpdate(state, cancel); err != nil {
				logging.Log.Error("manual update failed", zap.Error(err))
			}
		}()

		w.WriteHeader(http.StatusOK)
	}
}
