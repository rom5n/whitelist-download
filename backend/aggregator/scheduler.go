package aggregator

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// MaxPause is the longest allowed timed pause of configs auto update.
const MaxPause = 365 * 24 * time.Hour

var ErrInvalidPause = errors.New("invalid pause duration")

// UpdateEvent describes the outcome of a configs update.
type UpdateEvent struct {
	Manual bool          // Triggered by the user, not by the schedule
	Result *UpdateResult // Set if the update succeeded
	Err    error         // Set if the update failed
}

// Scheduler controls the configs auto update loop: pausing/resuming it and changing the update interval
// and the working check level. It also collects the outcome of updates. The state is persisted in the app
// config, so it survives restarts. It is shared between the polling loop, the HTTP API and the system tray.
type Scheduler struct {
	cfg        *config.Config
	statistics *domain.Statistics
	wake       chan struct{} // buffered (1): interrupts the polling loop's wait

	mu          sync.Mutex
	lastErr     error
	subscribers []func(UpdateEvent)
}

func NewScheduler(cfg *config.Config, statistics *domain.Statistics) *Scheduler {
	return &Scheduler{cfg: cfg, statistics: statistics, wake: make(chan struct{}, 1)}
}

// State returns the current pause and check level state.
func (s *Scheduler) State() domain.PollingState {
	return stateAt(s.cfg.RetrieveSafe(config.PausedUntil, config.WorkingCheckLevel), time.Now())
}

// PauseFor pauses auto updates for the given duration.
func (s *Scheduler) PauseFor(d time.Duration) error {
	if d <= 0 || d > MaxPause {
		return fmt.Errorf("%w: %s", ErrInvalidPause, d)
	}

	until := time.Now().Add(d).Unix()
	if err := s.cfg.SetPausedUntil(until); err != nil {
		return fmt.Errorf("pause updates: %w", err)
	}

	logging.Log.Info("configs auto update paused", zap.Time("until", time.Unix(until, 0)))
	s.notify()
	return nil
}

// PauseForever pauses auto updates until Resume is called.
func (s *Scheduler) PauseForever() error {
	if err := s.cfg.SetPausedUntil(config.PausedForever); err != nil {
		return fmt.Errorf("pause updates: %w", err)
	}

	logging.Log.Info("configs auto update paused until resumed")
	s.notify()
	return nil
}

// Resume cancels the pause. The polling loop updates configs right away if it was paused.
func (s *Scheduler) Resume() error {
	wasPaused := s.State().Paused

	if err := s.cfg.SetPausedUntil(0); err != nil {
		return fmt.Errorf("resume updates: %w", err)
	}

	if wasPaused {
		logging.Log.Info("configs auto update resumed")
		s.notify()
	}
	return nil
}

// SetWorkingCheckLevel changes the working check level. It applies from the next update.
func (s *Scheduler) SetWorkingCheckLevel(level int) error {
	if err := s.cfg.SetWorkingCheckLevel(level); err != nil {
		return err
	}

	logging.Log.Info("working check level changed", zap.Int("level", level))
	return nil
}

// SetUpdateInterval changes the interval (in minutes) between scheduled updates.
// The next update is rescheduled relative to the last one.
func (s *Scheduler) SetUpdateInterval(minutes int) error {
	if err := s.cfg.SetUpdateInterval(minutes); err != nil {
		return err
	}

	s.statistics.SetUpdateInterval(minutes)
	logging.Log.Info("update interval changed", zap.Int("minutes", minutes))
	s.Reschedule()
	return nil
}

// Reschedule makes the polling loop re-read the config (for example, after the update interval was changed).
func (s *Scheduler) Reschedule() {
	s.notify()
}

// Subscribe registers a callback for the outcome of every update. Callbacks are called synchronously
// by the goroutine that ran the update, so they must not block. Subscribe before starting updates.
func (s *Scheduler) Subscribe(callback func(UpdateEvent)) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.subscribers = append(s.subscribers, callback)
}

// ReportUpdate records the outcome of an update and passes it to the subscribers.
func (s *Scheduler) ReportUpdate(event UpdateEvent) {
	s.mu.Lock()
	s.lastErr = event.Err
	subscribers := s.subscribers
	s.mu.Unlock()

	for _, callback := range subscribers {
		callback(event)
	}
}

// LastError returns the error of the latest update, or nil if it succeeded (or no update has finished yet).
func (s *Scheduler) LastError() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.lastErr
}

func (s *Scheduler) notify() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// wait blocks until the timeout elapses, the loop is woken by a pause state change, or ctx is cancelled.
// It returns false only when ctx is cancelled.
func (s *Scheduler) wait(ctx context.Context, timeout time.Duration) bool {
	timer := time.NewTimer(max(timeout, 0))
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false
	case <-s.wake:
	case <-timer.C:
	}

	return true
}

// waitUntilWoken blocks until the loop is woken by a pause state change or ctx is cancelled.
// It returns false only when ctx is cancelled.
func (s *Scheduler) waitUntilWoken(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return false
	case <-s.wake:
		return true
	}
}

// waitForResume blocks while updates are paused.
func (s *Scheduler) waitForResume(ctx context.Context, state domain.PollingState) bool {
	if state.Forever {
		return s.waitUntilWoken(ctx)
	}

	return s.wait(ctx, time.Until(time.Unix(state.PausedUntil, 0)))
}

func stateAt(cfg *config.Config, now time.Time) domain.PollingState {
	state := domain.PollingState{WorkingCheckLevel: cfg.WorkingCheckLevel}

	switch {
	case cfg.PausedUntil == config.PausedForever:
		state.Paused = true
		state.Forever = true
	case cfg.PausedUntil > now.Unix():
		state.Paused = true
		state.PausedUntil = cfg.PausedUntil
	}

	return state
}
