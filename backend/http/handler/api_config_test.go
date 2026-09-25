package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/internal/testenv"
)

type configEnv struct {
	cfg *config.Config
	set func(http.ResponseWriter, *http.Request)
}

func newConfigEnv(t *testing.T) *configEnv {
	t.Helper()
	testenv.Isolate(t)

	cfg := &config.Config{
		AppName: "App", Port: "55000", SubscriptionPath: "/sub", ConfigsPath: "configs.txt",
		UpdateInterval: 60, WorkingCheckLevel: config.WorkingCheckPing, Sources: []string{"https://example.com/a.txt"},
	}
	cfg.MarkStarted()

	stats := &domain.Statistics{}
	scheduler := aggregator.NewScheduler(cfg, stats)

	return &configEnv{cfg: cfg, set: SetConfig(context.Background(), cfg, &domain.SafeUpdaterState{}, stats, func() {}, scheduler)}
}

// post sends the config, changed by change, the way the dashboard does.
func (e *configEnv) post(t *testing.T, change func(*config.Config)) (*httptest.ResponseRecorder, RestartState) {
	t.Helper()

	sent := &config.Config{
		AppName: "App", Port: "55000", SubscriptionPath: "/sub", ConfigsPath: "configs.txt",
		UpdateInterval: 60, WorkingCheckLevel: config.WorkingCheckPing, Sources: []string{"https://example.com/a.txt"},
	}
	change(sent)

	body, err := json.Marshal(sent)
	if err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	e.set(rec, httptest.NewRequest(http.MethodPost, "/api/set-config", strings.NewReader(string(body))))

	var state RestartState
	if rec.Code == http.StatusOK {
		if err = json.NewDecoder(rec.Body).Decode(&state); err != nil {
			t.Fatalf("response is not a restart state: %v", err)
		}
	}
	return rec, state
}

func TestSetConfigSavesImmediatelyApplicableSettings(t *testing.T) {
	e := newConfigEnv(t)

	rec, state := e.post(t, func(c *config.Config) { c.SubscriptionTitle = "New title"; c.UpdateInterval = 30 })
	if rec.Code != http.StatusOK || state.Required || len(state.Fields) != 0 {
		t.Fatalf("code=%d state=%+v", rec.Code, state)
	}

	got := e.cfg.RetrieveSafe(config.SubscriptionTitle, config.UpdateInterval)
	if got.SubscriptionTitle != "New title" || got.UpdateInterval != 30 {
		t.Errorf("the config was not updated: %+v", got)
	}
}

func TestSetConfigReportsPendingRestart(t *testing.T) {
	e := newConfigEnv(t)

	rec, state := e.post(t, func(c *config.Config) { c.Port = "8080"; c.SubscriptionPath = "/other" })
	if rec.Code != http.StatusOK || !state.Required || strings.Join(state.Fields, ",") != "port,subscription_path" {
		t.Fatalf("code=%d state=%+v", rec.Code, state)
	}

	// The state is available separately, e.g. after the dashboard is reloaded
	get := httptest.NewRecorder()
	RestartRequired(e.cfg)(get, httptest.NewRequest(http.MethodGet, "/api/restart-required", nil))

	var fromGet RestartState
	if err := json.NewDecoder(get.Body).Decode(&fromGet); err != nil {
		t.Fatal(err)
	}
	if !fromGet.Required || strings.Join(fromGet.Fields, ",") != "port,subscription_path" {
		t.Errorf("GET /api/restart-required = %+v", fromGet)
	}

	// Putting the values back cancels it
	if _, state = e.post(t, func(*config.Config) {}); state.Required {
		t.Errorf("the restart is not needed anymore, got %+v", state)
	}
}

func TestRestartRequiredIsAnEmptyListWhenNothingChanged(t *testing.T) {
	e := newConfigEnv(t)

	rec := httptest.NewRecorder()
	RestartRequired(e.cfg)(rec, httptest.NewRequest(http.MethodGet, "/api/restart-required", nil))

	if got := strings.TrimSpace(rec.Body.String()); got != `{"required":false,"fields":[]}` {
		t.Errorf("body = %s", got)
	}
}

func TestSetConfigRejectsInvalidValues(t *testing.T) {
	e := newConfigEnv(t)

	for name, change := range map[string]func(*config.Config){
		"empty port":       func(c *config.Config) { c.Port = "" },
		"path without /":   func(c *config.Config) { c.SubscriptionPath = "sub" },
		"zero interval":    func(c *config.Config) { c.UpdateInterval = 0 },
		"invalid source":   func(c *config.Config) { c.Sources = []string{"nope"} },
		"reserved path":    func(c *config.Config) { c.SubscriptionPath = "/api" },
		"unknown level":    func(c *config.Config) { c.WorkingCheckLevel = 9 },
		"empty app name":   func(c *config.Config) { c.AppName = "" },
		"empty configs":    func(c *config.Config) { c.ConfigsPath = "" },
		"forced ip spaces": func(c *config.Config) { c.ForcedIP = "1 2" },
	} {
		rec, _ := e.post(t, change)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: code = %d, want 400", name, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "invalid config") {
			t.Errorf("%s: the message does not explain the problem: %q", name, rec.Body.String())
		}
	}

	// Nothing invalid was saved
	got := e.cfg.RetrieveSafe(config.Port, config.SubscriptionPath, config.UpdateInterval)
	if got.Port != "55000" || got.SubscriptionPath != "/sub" || got.UpdateInterval != 60 {
		t.Errorf("an invalid config changed the settings: %+v", got)
	}
	if pending := e.cfg.PendingRestart(); len(pending) != 0 {
		t.Errorf("an invalid config left a pending restart: %v", pending)
	}
}

func TestSetConfigRejectsBrokenRequests(t *testing.T) {
	e := newConfigEnv(t)

	rec := httptest.NewRecorder()
	e.set(rec, httptest.NewRequest(http.MethodPost, "/api/set-config", strings.NewReader(`{"port":`)))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("broken JSON: code = %d, want 400", rec.Code)
	}

	rec = httptest.NewRecorder()
	e.set(rec, httptest.NewRequest(http.MethodGet, "/api/set-config", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET: code = %d, want 405", rec.Code)
	}
}
