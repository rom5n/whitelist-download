package handler

import (
	"context"
	"encoding/json"
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

		err := json.NewEncoder(w).Encode(statistics)
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

		err := json.NewEncoder(w).Encode(cfg)
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

		newConfig := &config.Config{}
		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			logging.Log.Error("failed to decode config", zap.Error(err))
			http.Error(w, "failed to decode config", http.StatusInternalServerError)
			return
		}
		defer r.Body.Close()

		if err := cfg.Set(newConfig); err != nil {
			logging.Log.Error("failed to set config", zap.Error(err))
			http.Error(w, "failed to set config", http.StatusInternalServerError)
			return
		}

		stats.Lock()
		stats.UpdateInterval = cfg.UpdateInterval
		stats.Unlock()

		logging.Log.Info("app config updated")

		go updater.CheckUpdate(ctx, cfg, state, cancel)

		w.WriteHeader(http.StatusOK)
	}
}
