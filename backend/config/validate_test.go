package config

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateAcceptsDefaults(t *testing.T) {
	if err := Validate(newDefaultConfig()); err != nil {
		t.Fatalf("the default config must be valid: %v", err)
	}
}

func TestValidateRejects(t *testing.T) {
	tests := []struct {
		name   string
		change func(*Config)
		field  string
	}{
		{"empty app name", func(c *Config) { c.AppName = "  " }, "app_name"},
		{"slash in app name", func(c *Config) { c.AppName = "a/b" }, "app_name"},
		{"empty port", func(c *Config) { c.Port = "" }, "port"},
		{"port is not a number", func(c *Config) { c.Port = "80a" }, "port"},
		{"port zero", func(c *Config) { c.Port = "0" }, "port"},
		{"port too big", func(c *Config) { c.Port = "65536" }, "port"},
		{"empty subscription path", func(c *Config) { c.SubscriptionPath = "" }, "subscription_path"},
		{"path without a slash", func(c *Config) { c.SubscriptionPath = "sub" }, "subscription_path"},
		{"root path", func(c *Config) { c.SubscriptionPath = "/" }, "subscription_path"},
		{"trailing slash", func(c *Config) { c.SubscriptionPath = "/sub/" }, "subscription_path"},
		{"space in path", func(c *Config) { c.SubscriptionPath = "/my sub" }, "subscription_path"},
		{"api path", func(c *Config) { c.SubscriptionPath = "/api" }, "subscription_path"},
		{"nested api path", func(c *Config) { c.SubscriptionPath = "/api/sub" }, "subscription_path"},
		{"assets path", func(c *Config) { c.SubscriptionPath = "/assets" }, "subscription_path"},
		{"zero interval", func(c *Config) { c.UpdateInterval = 0 }, "update_interval_minutes"},
		{"negative interval", func(c *Config) { c.UpdateInterval = -5 }, "update_interval_minutes"},
		{"huge interval", func(c *Config) { c.UpdateInterval = MaxUpdateInterval + 1 }, "update_interval_minutes"},
		{"unknown check level", func(c *Config) { c.WorkingCheckLevel = 3 }, "working_check_level"},
		{"forced ip with a space", func(c *Config) { c.ForcedIP = "1.2.3.4 " }, "forced_ip"},
		{"source is not a url", func(c *Config) { c.Sources = []string{"not a url"} }, "sources"},
		{"source without a host", func(c *Config) { c.Sources = []string{"https://"} }, "sources"},
		{"source with another scheme", func(c *Config) { c.Sources = []string{"ftp://example.com/list.txt"} }, "sources"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := newDefaultConfig()
			tt.change(cfg)

			err := Validate(cfg)
			if !errors.Is(err, ErrInvalidConfig) {
				t.Fatalf("Validate error = %v, want ErrInvalidConfig", err)
			}
			if !strings.Contains(err.Error(), tt.field) {
				t.Errorf("the error %q does not name the field %q", err, tt.field)
			}
		})
	}
}

func TestValidateAcceptsValidValues(t *testing.T) {
	for name, change := range map[string]func(*Config){
		"nested path":     func(c *Config) { c.SubscriptionPath = "/my/sub-1.txt" },
		"custom port":     func(c *Config) { c.Port = "8080" },
		"forced host":     func(c *Config) { c.ForcedIP = "vpn.example.com" },
		"no sources":      func(c *Config) { c.Sources = nil },
		"http source":     func(c *Config) { c.Sources = []string{"http://example.com/a.txt"} },
		"max interval":    func(c *Config) { c.UpdateInterval = MaxUpdateInterval },
		"deep check":      func(c *Config) { c.WorkingCheckLevel = WorkingCheckSingBox },
		"assets-like":     func(c *Config) { c.SubscriptionPath = "/assets2" },
		"empty title":     func(c *Config) { c.SubscriptionTitle = "" },
		"unicode title":   func(c *Config) { c.SubscriptionTitle = "🌊 VPN" },
		"unicode app":     func(c *Config) { c.AppName = "Мой VPN" },
		"path with tilde": func(c *Config) { c.SubscriptionPath = "/~sub" },
	} {
		cfg := newDefaultConfig()
		change(cfg)

		if err := Validate(cfg); err != nil {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestPendingRestart(t *testing.T) {
	cfg := newDefaultConfig()

	if got := cfg.PendingRestart(); got != nil {
		t.Errorf("a config that did not record its start has no pending restart, got %v", got)
	}

	cfg.MarkStarted()
	if got := cfg.PendingRestart(); len(got) != 0 {
		t.Errorf("nothing changed yet, got %v", got)
	}

	// Settings that apply immediately don't require a restart
	cfg.SubscriptionTitle = "changed"
	cfg.UpdateInterval = 30
	cfg.ForcedIP = "10.0.0.1"
	if got := cfg.PendingRestart(); len(got) != 0 {
		t.Errorf("only start-time settings need a restart, got %v", got)
	}

	cfg.Port = "8080"
	cfg.SubscriptionPath = "/other"
	cfg.AppName = "Renamed"
	got := cfg.PendingRestart()
	want := []string{"app_name", "port", "subscription_path"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("PendingRestart = %v, want %v", got, want)
	}

	// Changing a value back cancels the pending restart
	cfg.Port = "55000"
	cfg.SubscriptionPath = "/sub"
	cfg.AppName = "WhitelistsDownload"
	if got := cfg.PendingRestart(); len(got) != 0 {
		t.Errorf("values are back to the started ones, got %v", got)
	}
}
