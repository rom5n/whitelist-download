package aggregator

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/internal/testenv"
)

type loopHarness struct {
	scheduler *Scheduler
	polls     atomic.Int32
	events    chan UpdateEvent
	stop      func()
}

// startLoop runs the polling loop with a fake update. The interval unit is 10ms, so an UpdateInterval of
// 10 means 100ms.
func startLoop(t *testing.T, updateInterval int, poll func(call int32) (*UpdateResult, error)) *loopHarness {
	t.Helper()
	testenv.Isolate(t)

	previousUnit, previousRetry := intervalUnit, retryDelay
	intervalUnit, retryDelay = 10*time.Millisecond, 20*time.Millisecond
	t.Cleanup(func() { intervalUnit, retryDelay = previousUnit, previousRetry })

	cfg := &config.Config{WorkingCheckLevel: config.WorkingCheckPing, UpdateInterval: updateInterval}
	h := &loopHarness{scheduler: NewScheduler(cfg, &domain.Statistics{UpdateInterval: updateInterval}), events: make(chan UpdateEvent, 100)}
	h.scheduler.Subscribe(func(event UpdateEvent) { h.events <- event })

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPollingLoop(ctx, cfg, h.scheduler, func(context.Context, *config.Config) (*UpdateResult, error) {
			return poll(h.polls.Add(1))
		}, func(*UpdateResult) {})
	}()

	h.stop = func() {
		cancel()

		done := make(chan struct{})
		go func() { wg.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Error("the polling loop did not stop after the context was cancelled")
		}
	}
	t.Cleanup(h.stop)

	return h
}

func ok(int32) (*UpdateResult, error) { return &UpdateResult{AmountConfigs: 1}, nil }

func waitFor(t *testing.T, what string, condition func() bool) {
	t.Helper()

	deadline := time.Now().Add(2 * time.Second)
	for !condition() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestLoopPollsOnSchedule(t *testing.T) {
	h := startLoop(t, 3, ok) // every 30ms

	waitFor(t, "3 updates", func() bool { return h.polls.Load() >= 3 })

	for i := 0; i < 3; i++ {
		select {
		case event := <-h.events:
			if event.Err != nil || event.Manual || event.Result == nil {
				t.Fatalf("unexpected event: %+v", event)
			}
		case <-time.After(time.Second):
			t.Fatal("no update event")
		}
	}
}

func TestLoopPauseAndResume(t *testing.T) {
	h := startLoop(t, 100000, ok) // the next scheduled update is far away

	waitFor(t, "the first update", func() bool { return h.polls.Load() == 1 })

	if err := h.scheduler.PauseForever(); err != nil {
		t.Fatal(err)
	}
	time.Sleep(50 * time.Millisecond)
	if err := h.scheduler.Resume(); err != nil {
		t.Fatal(err)
	}

	// Configs are updated right after the pause ends, not at the next scheduled time
	waitFor(t, "an update after resuming", func() bool { return h.polls.Load() == 2 })
}

func TestLoopDoesNotPollWhilePaused(t *testing.T) {
	h := startLoop(t, 2, ok) // every 20ms

	waitFor(t, "the first update", func() bool { return h.polls.Load() >= 1 })
	if err := h.scheduler.PauseForever(); err != nil {
		t.Fatal(err)
	}

	time.Sleep(60 * time.Millisecond) // lets an update that was already running finish
	paused := h.polls.Load()
	time.Sleep(150 * time.Millisecond)
	if got := h.polls.Load(); got != paused {
		t.Errorf("updates ran while paused: %d -> %d", paused, got)
	}
}

func TestLoopTimedPauseEndsByItself(t *testing.T) {
	h := startLoop(t, 100000, ok)

	waitFor(t, "the first update", func() bool { return h.polls.Load() == 1 })

	// The pause is stored in whole seconds, so it ends at the next second boundary
	if err := h.scheduler.PauseFor(time.Second); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "an update after the pause", func() bool { return h.polls.Load() == 2 })
}

func TestLoopIntervalChangeReschedules(t *testing.T) {
	h := startLoop(t, 100000, ok) // ~17 minutes

	waitFor(t, "the first update", func() bool { return h.polls.Load() == 1 })

	if err := h.scheduler.SetUpdateInterval(3); err != nil { // 30ms
		t.Fatal(err)
	}
	waitFor(t, "an update after shortening the interval", func() bool { return h.polls.Load() >= 2 })

	h.scheduler.statistics.RLock()
	shown := h.scheduler.statistics.UpdateInterval
	h.scheduler.statistics.RUnlock()
	if shown != 3 {
		t.Errorf("the dashboard interval = %d, want 3", shown)
	}
}

func TestLoopRetriesAfterFailure(t *testing.T) {
	h := startLoop(t, 100000, func(call int32) (*UpdateResult, error) {
		if call <= 2 {
			return nil, errors.New("sources are down")
		}
		return &UpdateResult{AmountConfigs: 5}, nil
	})

	waitFor(t, "3 updates", func() bool { return h.polls.Load() == 3 })

	var errs, successes int
	for i := 0; i < 3; i++ {
		select {
		case event := <-h.events:
			if event.Err != nil {
				errs++
			} else {
				successes++
			}
		case <-time.After(time.Second):
			t.Fatal("no update event")
		}
	}
	if errs != 2 || successes != 1 {
		t.Errorf("events: %d failures and %d successes, want 2 and 1", errs, successes)
	}
	if err := h.scheduler.LastError(); err != nil {
		t.Errorf("LastError = %v after a successful update", err)
	}
}

func TestLoopShutdownIsNotReportedAsFailure(t *testing.T) {
	started := make(chan struct{})
	testenv.Isolate(t)

	cfg := &config.Config{UpdateInterval: 60}
	scheduler := NewScheduler(cfg, &domain.Statistics{})
	var reported atomic.Bool
	scheduler.Subscribe(func(UpdateEvent) { reported.Store(true) })

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		runPollingLoop(ctx, cfg, scheduler, func(ctx context.Context, _ *config.Config) (*UpdateResult, error) {
			close(started)
			<-ctx.Done()
			return nil, ctx.Err()
		}, func(*UpdateResult) {})
	}()

	<-started
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the loop did not stop")
	}

	if reported.Load() || scheduler.LastError() != nil {
		t.Error("an update interrupted by the shutdown must not be reported as a failure")
	}
}
