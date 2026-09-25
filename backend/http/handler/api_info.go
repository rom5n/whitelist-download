package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/updater"
	"go.uber.org/zap"
)

func SubscriptionLink(cfg *config.Config, ip, port string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		cfgSafe := cfg.RetrieveSafe(config.ForcedIP, config.SubscriptionPath)
		forcedIP := cfgSafe.ForcedIP
		subPath := cfgSafe.SubscriptionPath

		if forcedIP != "" {
			ip = forcedIP
		}

		subLink := fmt.Sprintf("%v://%v:%v%v", "http", ip, port, subPath)

		w.Write([]byte(subLink))
	}
}

func Statistics(statistics *domain.Statistics) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		statistics.RLock()
		err := json.NewEncoder(w).Encode(statistics)
		statistics.RUnlock()
		if err != nil {
			logging.Log.Error("failed to get statistics", zap.Error(err))
			http.Error(w, "failed to get statistics", http.StatusInternalServerError)
			return
		}
		logging.Log.Debug("statistics sent")
	}
}

func Config(cfg *config.Config) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		cfg.RLock()
		err := json.NewEncoder(w).Encode(cfg)
		cfg.RUnlock()
		if err != nil {
			logging.Log.Error("failed to get config", zap.Error(err))
			http.Error(w, "failed to get config", http.StatusInternalServerError)
			return
		}
		logging.Log.Debug("config sent")
	}
}

func SetConfig(ctx context.Context, cfg *config.Config, state *domain.SafeUpdaterState, stats *domain.Statistics, cancel context.CancelFunc) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		newConfig := &config.Config{}
		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			logging.Log.Error("failed to decode config", zap.Error(err))
			http.Error(w, "failed to decode config", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		if err := cfg.Set(newConfig); err != nil {
			if errors.Is(err, config.ErrInvalidConfig) {
				logging.Log.Warn("rejected invalid config", zap.Error(err))
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			logging.Log.Error("failed to set config", zap.Error(err))
			http.Error(w, "failed to set config", http.StatusInternalServerError)
			return
		}

		stats.Lock()
		stats.UpdateInterval = cfg.RetrieveSafe(config.UpdateInterval).UpdateInterval
		stats.Unlock()

		logging.Log.Info("app config updated")

		go updater.CheckUpdate(ctx, cfg, state, cancel)

		writeRestartStatus(w, cfg)
	}
}

// RestartStatusResponse tells the dashboard whether saved settings wait for a restart
type RestartStatusResponse struct {
	RestartRequired bool     `json:"restart_required"`
	Fields          []string `json:"fields"`
}

func RestartStatus(cfg *config.Config) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		writeRestartStatus(w, cfg)
	}
}

func writeRestartStatus(w http.ResponseWriter, cfg *config.Config) {
	fields := cfg.RestartRequiredFields()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(RestartStatusResponse{RestartRequired: len(fields) > 0, Fields: fields}); err != nil {
		logging.Log.Error("failed to encode restart status", zap.Error(err))
	}
}
