package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/updater"
	"go.uber.org/zap"
)

const maxConfigBodySize = 1 << 20

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

// RestartState tells which changed settings only take effect after a restart.
type RestartState struct {
	Required bool     `json:"required"`
	Fields   []string `json:"fields"` // JSON keys of the settings
}

func restartState(cfg *config.Config) RestartState {
	fields := cfg.PendingRestart()
	if fields == nil {
		fields = []string{}
	}

	return RestartState{Required: len(fields) > 0, Fields: fields}
}

// RestartRequired returns the settings that were changed after the start and await a restart.
func RestartRequired(cfg *config.Config) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if err := json.NewEncoder(w).Encode(restartState(cfg)); err != nil {
			logging.Log.Error("failed to encode restart state", zap.Error(err))
		}
	}
}

// SetConfig validates and saves the settings. The dashboard saves them as they change, so it is called often.
// It responds with the RestartState.
func SetConfig(ctx context.Context, cfg *config.Config, state *domain.SafeUpdaterState, stats *domain.Statistics, cancel context.CancelFunc, scheduler *aggregator.Scheduler) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		newConfig := &config.Config{}
		defer r.Body.Close()
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxConfigBodySize)).Decode(newConfig); err != nil {
			logging.Log.Warn("failed to decode config", zap.Error(err))
			http.Error(w, "failed to decode config", http.StatusBadRequest)
			return
		}

		if err := config.Validate(newConfig); err != nil {
			logging.Log.Warn("rejected invalid config", zap.Error(err))
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		before := cfg.RetrieveSafe(config.AutoUpdateMajor, config.AutoUpdatePatch)

		if err := cfg.Set(newConfig); err != nil {
			logging.Log.Error("failed to set config", zap.Error(err))
			http.Error(w, "failed to set config", http.StatusInternalServerError)
			return
		}

		stats.SetUpdateInterval(cfg.RetrieveSafe(config.UpdateInterval).UpdateInterval)
		scheduler.Reschedule()

		logging.Log.Info("app config updated")

		// Only a change of the auto update policy needs a fresh look at the releases
		if after := cfg.RetrieveSafe(config.AutoUpdateMajor, config.AutoUpdatePatch); after.AutoUpdateMajor != before.AutoUpdateMajor || after.AutoUpdatePatch != before.AutoUpdatePatch {
			go updater.CheckUpdate(ctx, cfg, state, cancel)
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err := json.NewEncoder(w).Encode(restartState(cfg)); err != nil {
			logging.Log.Error("failed to encode restart state", zap.Error(err))
		}
	}
}
