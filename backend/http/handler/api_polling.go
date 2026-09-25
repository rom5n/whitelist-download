package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

const maxControlBodySize = 1 << 10

type pauseRequest struct {
	Minutes int  `json:"minutes"` // Pause duration in minutes
	Forever bool `json:"forever"` // Pause until resumed manually; takes precedence over Minutes
}

type checkLevelRequest struct {
	Level int `json:"level"` // 1 - ping test, 2 - sing-box core test
}

// PollingState returns the configs auto update state: pause and working check level.
func PollingState(scheduler *aggregator.Scheduler) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		writePollingState(w, scheduler)
	}
}

// PollingPause pauses the configs auto update for a given time or until resumed.
func PollingPause(scheduler *aggregator.Scheduler) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req pauseRequest
		if !decodeControlRequest(w, r, &req) {
			return
		}

		var err error
		if req.Forever {
			err = scheduler.PauseForever()
		} else {
			err = scheduler.PauseFor(time.Duration(req.Minutes) * time.Minute)
		}
		if err != nil {
			writeControlError(w, "failed to pause updates", err, aggregator.ErrInvalidPause)
			return
		}

		writePollingState(w, scheduler)
	}
}

// PollingResume cancels the pause of the configs auto update.
func PollingResume(scheduler *aggregator.Scheduler) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if err := scheduler.Resume(); err != nil {
			writeControlError(w, "failed to resume updates", err, nil)
			return
		}

		writePollingState(w, scheduler)
	}
}

// PollingCheckLevel changes the working check level. It applies from the next update.
func PollingCheckLevel(scheduler *aggregator.Scheduler) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req checkLevelRequest
		if !decodeControlRequest(w, r, &req) {
			return
		}

		if err := scheduler.SetWorkingCheckLevel(req.Level); err != nil {
			writeControlError(w, "failed to change working check level", err, config.ErrInvalidCheckLevel)
			return
		}

		writePollingState(w, scheduler)
	}
}

func decodeControlRequest(w http.ResponseWriter, r *http.Request, dst any) bool {
	defer r.Body.Close()

	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxControlBodySize)).Decode(dst); err != nil {
		logging.Log.Warn("failed to decode control request", zap.String("path", r.URL.Path), zap.Error(err))
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return false
	}

	return true
}

// writeControlError responds with 400 if err is the given validation error, otherwise with 500.
func writeControlError(w http.ResponseWriter, message string, err, validationErr error) {
	logging.Log.Error(message, zap.Error(err))

	if validationErr != nil && errors.Is(err, validationErr) {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	http.Error(w, message, http.StatusInternalServerError)
}

func writePollingState(w http.ResponseWriter, scheduler *aggregator.Scheduler) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if err := json.NewEncoder(w).Encode(scheduler.State()); err != nil {
		logging.Log.Error("failed to encode polling state", zap.Error(err))
	}
}
