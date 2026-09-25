package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/internal/testenv"
)

func newTestScheduler(t *testing.T) *aggregator.Scheduler {
	t.Helper()
	testenv.Isolate(t)

	return aggregator.NewScheduler(&config.Config{WorkingCheckLevel: config.WorkingCheckPing}, &domain.Statistics{})
}

func call(t *testing.T, handler func(http.ResponseWriter, *http.Request), method, body string) (*httptest.ResponseRecorder, domain.PollingState) {
	t.Helper()

	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	rec := httptest.NewRecorder()
	handler(rec, req)

	var state domain.PollingState
	if rec.Code == http.StatusOK {
		if err := json.NewDecoder(rec.Body).Decode(&state); err != nil {
			t.Fatalf("response is not a polling state: %v", err)
		}
	}

	return rec, state
}

func TestPollingState(t *testing.T) {
	s := newTestScheduler(t)

	rec, state := call(t, PollingState(s), http.MethodGet, "")
	if rec.Code != http.StatusOK || state.Paused || state.WorkingCheckLevel != config.WorkingCheckPing {
		t.Fatalf("unexpected default state: code=%d state=%+v", rec.Code, state)
	}

	if rec, _ = call(t, PollingState(s), http.MethodPost, ""); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST /api/polling code = %d, want 405", rec.Code)
	}
}

func TestPollingPause(t *testing.T) {
	s := newTestScheduler(t)

	rec, state := call(t, PollingPause(s), http.MethodPost, `{"minutes": 60}`)
	if rec.Code != http.StatusOK || !state.Paused || state.Forever {
		t.Fatalf("timed pause: code=%d state=%+v", rec.Code, state)
	}
	if remaining := time.Until(time.Unix(state.PausedUntil, 0)); remaining < 59*time.Minute || remaining > time.Hour {
		t.Errorf("remaining pause = %s, want about 1h", remaining)
	}

	rec, state = call(t, PollingPause(s), http.MethodPost, `{"forever": true}`)
	if rec.Code != http.StatusOK || !state.Paused || !state.Forever {
		t.Fatalf("pause forever: code=%d state=%+v", rec.Code, state)
	}

	for name, body := range map[string]string{
		"zero minutes": `{"minutes": 0}`,
		"negative":     `{"minutes": -5}`,
		"too long":     `{"minutes": 999999999}`,
		"empty":        `{}`,
		"bad json":     `{"minutes":`,
	} {
		if rec, _ = call(t, PollingPause(s), http.MethodPost, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: code = %d, want 400", name, rec.Code)
		}
	}

	if rec, _ = call(t, PollingPause(s), http.MethodGet, ""); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET /api/polling/pause code = %d, want 405", rec.Code)
	}
}

func TestPollingResume(t *testing.T) {
	s := newTestScheduler(t)

	call(t, PollingPause(s), http.MethodPost, `{"forever": true}`)

	rec, state := call(t, PollingResume(s), http.MethodPost, "")
	if rec.Code != http.StatusOK || state.Paused {
		t.Fatalf("resume: code=%d state=%+v", rec.Code, state)
	}
}

func TestPollingCheckLevel(t *testing.T) {
	s := newTestScheduler(t)

	rec, state := call(t, PollingCheckLevel(s), http.MethodPost, `{"level": 2}`)
	if rec.Code != http.StatusOK || state.WorkingCheckLevel != config.WorkingCheckSingBox {
		t.Fatalf("set level 2: code=%d state=%+v", rec.Code, state)
	}

	for name, body := range map[string]string{"unknown level": `{"level": 3}`, "missing level": `{}`, "bad json": `nope`} {
		if rec, _ = call(t, PollingCheckLevel(s), http.MethodPost, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: code = %d, want 400", name, rec.Code)
		}
	}

	if got := s.State().WorkingCheckLevel; got != config.WorkingCheckSingBox {
		t.Errorf("rejected requests changed the level to %d", got)
	}
}
