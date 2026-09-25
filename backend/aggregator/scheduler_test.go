package aggregator

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/adrg/xdg"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/internal/testenv"
)

func newTestScheduler(t *testing.T) *Scheduler {
	t.Helper()
	testenv.Isolate(t)

	return NewScheduler(&config.Config{WorkingCheckLevel: config.WorkingCheckPing, UpdateInterval: 60}, &domain.Statistics{UpdateInterval: 60})
}

func TestStateAt(t *testing.T) {
	now := time.Unix(1_000_000, 0)

	tests := []struct {
		name        string
		pausedUntil int64
		paused      bool
		forever     bool
		until       int64
	}{
		{"not paused", 0, false, false, 0},
		{"paused forever", config.PausedForever, true, true, 0},
		{"paused for a while", now.Unix() + 60, true, false, now.Unix() + 60},
		{"pause expired exactly now", now.Unix(), false, false, 0},
		{"pause expired", now.Unix() - 60, false, false, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			state := stateAt(&config.Config{PausedUntil: tt.pausedUntil, WorkingCheckLevel: 2}, now)

			if state.Paused != tt.paused || state.Forever != tt.forever || state.PausedUntil != tt.until {
				t.Errorf("got %+v, want paused=%v forever=%v until=%d", state, tt.paused, tt.forever, tt.until)
			}
			if state.WorkingCheckLevel != 2 {
				t.Errorf("working check level = %d, want 2", state.WorkingCheckLevel)
			}
		})
	}
}

func TestPauseAndResume(t *testing.T) {
	s := newTestScheduler(t)

	if err := s.PauseFor(time.Hour); err != nil {
		t.Fatalf("PauseFor: %v", err)
	}
	state := s.State()
	if !state.Paused || state.Forever {
		t.Fatalf("expected a timed pause, got %+v", state)
	}
	if remaining := time.Until(time.Unix(state.PausedUntil, 0)); remaining < 59*time.Minute || remaining > time.Hour {
		t.Errorf("remaining pause = %s, want about 1h", remaining)
	}
	if len(s.wake) != 1 {
		t.Error("pausing must wake the polling loop")
	}

	if err := s.PauseForever(); err != nil {
		t.Fatalf("PauseForever: %v", err)
	}
	if state = s.State(); !state.Paused || !state.Forever || state.PausedUntil != 0 {
		t.Fatalf("expected a pause until resumed, got %+v", state)
	}

	path, err := xdg.ConfigFile("whitelist-download/config.json")
	if err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(path); err != nil || !strings.Contains(string(data), `"paused_until": -1`) {
		t.Errorf("pause must be persisted in config.json, got %q (err: %v)", data, err)
	}

	<-s.wake
	if err := s.Resume(); err != nil {
		t.Fatalf("Resume: %v", err)
	}
	if state = s.State(); state.Paused {
		t.Fatalf("expected updates to be active, got %+v", state)
	}
	if len(s.wake) != 1 {
		t.Error("resuming must wake the polling loop")
	}
}

func TestResumeWhenNotPausedDoesNotWake(t *testing.T) {
	s := newTestScheduler(t)

	if err := s.Resume(); err != nil {
		t.Fatalf("Resume: %v", err)
	}
	if len(s.wake) != 0 {
		t.Error("resuming active updates must not trigger an extra update")
	}
}

func TestPauseForInvalidDuration(t *testing.T) {
	s := newTestScheduler(t)

	for _, d := range []time.Duration{0, -time.Minute, MaxPause + time.Second} {
		if err := s.PauseFor(d); !errors.Is(err, ErrInvalidPause) {
			t.Errorf("PauseFor(%s) error = %v, want ErrInvalidPause", d, err)
		}
	}
	if s.State().Paused {
		t.Error("invalid pause must not pause updates")
	}
}

func TestSetWorkingCheckLevel(t *testing.T) {
	s := newTestScheduler(t)

	if err := s.SetWorkingCheckLevel(config.WorkingCheckSingBox); err != nil {
		t.Fatalf("SetWorkingCheckLevel: %v", err)
	}
	if got := s.State().WorkingCheckLevel; got != config.WorkingCheckSingBox {
		t.Errorf("level = %d, want %d", got, config.WorkingCheckSingBox)
	}

	for _, level := range []int{0, 3, -1} {
		if err := s.SetWorkingCheckLevel(level); !errors.Is(err, config.ErrInvalidCheckLevel) {
			t.Errorf("SetWorkingCheckLevel(%d) error = %v, want ErrInvalidCheckLevel", level, err)
		}
	}
	if got := s.State().WorkingCheckLevel; got != config.WorkingCheckSingBox {
		t.Errorf("invalid level changed the level to %d", got)
	}
}

func TestWait(t *testing.T) {
	s := newTestScheduler(t)

	t.Run("timeout elapses", func(t *testing.T) {
		start := time.Now()
		if !s.wait(context.Background(), 20*time.Millisecond) {
			t.Fatal("wait reported cancellation")
		}
		if time.Since(start) < 15*time.Millisecond {
			t.Error("wait returned before the timeout")
		}
	})

	t.Run("woken up", func(t *testing.T) {
		s.notify()
		start := time.Now()
		if !s.wait(context.Background(), time.Minute) || time.Since(start) > time.Second {
			t.Error("wait was not interrupted by notify")
		}
	})

	t.Run("cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if s.wait(ctx, time.Minute) || s.waitUntilWoken(ctx) {
			t.Error("waiting must report cancellation")
		}
	})

	t.Run("until woken", func(t *testing.T) {
		done := make(chan bool)
		go func() { done <- s.waitUntilWoken(context.Background()) }()

		select {
		case <-done:
			t.Fatal("waitUntilWoken returned without a wake-up")
		case <-time.After(30 * time.Millisecond):
		}

		s.notify()
		if ok := <-done; !ok {
			t.Error("wait reported cancellation")
		}
	})
}

func TestWaitForResume(t *testing.T) {
	s := newTestScheduler(t)

	// A pause until resumed only ends on a wake-up.
	state := s.State()
	state.Paused, state.Forever = true, true

	done := make(chan bool)
	go func() { done <- s.waitForResume(context.Background(), state) }()

	select {
	case <-done:
		t.Fatal("waitForResume returned while the pause was still active")
	case <-time.After(30 * time.Millisecond):
	}

	s.notify()
	if ok := <-done; !ok {
		t.Error("waitForResume reported cancellation")
	}

	// A timed pause that is already over must not block.
	state = domain.PollingState{Paused: true, PausedUntil: time.Now().Add(-time.Second).Unix()}
	if !s.waitForResume(context.Background(), state) {
		t.Error("waitForResume reported cancellation")
	}
}

func TestSetUpdateInterval(t *testing.T) {
	s := newTestScheduler(t)

	if err := s.SetUpdateInterval(180); err != nil {
		t.Fatalf("SetUpdateInterval: %v", err)
	}
	if got := s.cfg.RetrieveSafe(config.UpdateInterval).UpdateInterval; got != 180 {
		t.Errorf("config interval = %d, want 180", got)
	}
	if s.statistics.UpdateInterval != 180 {
		t.Errorf("dashboard interval = %d, want 180", s.statistics.UpdateInterval)
	}
	if len(s.wake) != 1 {
		t.Error("changing the interval must wake the polling loop")
	}

	for _, minutes := range []int{0, -5, config.MaxUpdateInterval + 1} {
		if err := s.SetUpdateInterval(minutes); !errors.Is(err, config.ErrInvalidInterval) {
			t.Errorf("SetUpdateInterval(%d) error = %v, want ErrInvalidInterval", minutes, err)
		}
	}
	if got := s.cfg.RetrieveSafe(config.UpdateInterval).UpdateInterval; got != 180 {
		t.Errorf("invalid interval changed the config to %d", got)
	}
}

func TestReportUpdate(t *testing.T) {
	s := newTestScheduler(t)

	var events []UpdateEvent
	s.Subscribe(func(event UpdateEvent) { events = append(events, event) })

	if s.LastError() != nil {
		t.Error("LastError must be nil before any update")
	}

	failure := errors.New("all sources failed")
	s.ReportUpdate(UpdateEvent{Manual: true, Err: failure})
	if !errors.Is(s.LastError(), failure) {
		t.Errorf("LastError = %v, want %v", s.LastError(), failure)
	}

	s.ReportUpdate(UpdateEvent{Result: &UpdateResult{AmountConfigs: 7}})
	if s.LastError() != nil {
		t.Errorf("LastError = %v after a successful update", s.LastError())
	}

	if len(events) != 2 || !events[0].Manual || events[1].Result.AmountConfigs != 7 {
		t.Errorf("subscriber got %+v", events)
	}
}
