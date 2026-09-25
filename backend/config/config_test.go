package config

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/adrg/xdg"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

func TestMain(m *testing.M) {
	logging.Log = zap.NewNop()
	os.Exit(m.Run())
}

func useTempDataDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("XDG_DATA_HOME", dir)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(dir, "config"))
	xdg.Reload()
	t.Cleanup(xdg.Reload)
	return filepath.Join(dir, "whitelist-download")
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(c *Config)
		wantErr bool
	}{
		{"defaults", func(c *Config) {}, false},
		{"interval below min", func(c *Config) { c.UpdateInterval = MinUpdateInterval - 1 }, true},
		{"interval above max", func(c *Config) { c.UpdateInterval = MaxUpdateInterval + 1 }, true},
		{"interval at bounds", func(c *Config) { c.UpdateInterval = MaxUpdateInterval }, false},
		{"port not a number", func(c *Config) { c.Port = "abc" }, true},
		{"port out of range", func(c *Config) { c.Port = "70000" }, true},
		{"unknown check level", func(c *Config) { c.WorkingCheckLevel = 3 }, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newDefaultConfig()
			tt.mutate(c)
			err := c.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && !errors.Is(err, ErrInvalidConfig) {
				t.Fatalf("error must wrap ErrInvalidConfig, got %v", err)
			}
		})
	}
}

func TestDefaultUpdateInterval(t *testing.T) {
	if got := newDefaultConfig().UpdateInterval; got != 15 {
		t.Fatalf("default update interval = %d, want 15", got)
	}
}

func TestClampUpdateInterval(t *testing.T) {
	cases := map[int]int{0: MinUpdateInterval, -3: MinUpdateInterval, 60: 60, 99999: MaxUpdateInterval}
	for in, want := range cases {
		if got := clampUpdateInterval(in); got != want {
			t.Errorf("clampUpdateInterval(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestRestartRequiredFields(t *testing.T) {
	useTempDataDir(t)

	c := newDefaultConfig()
	c.captureBootValues()
	if fields := c.RestartRequiredFields(); len(fields) != 0 {
		t.Fatalf("fresh config must not require restart, got %v", fields)
	}

	next := newDefaultConfig()
	next.Port = "55001"
	next.UpdateInterval = 30
	if err := c.Set(next); err != nil {
		t.Fatalf("Set() error = %v", err)
	}
	if fields := c.RestartRequiredFields(); !slices.Equal(fields, []string{"port"}) {
		t.Fatalf("RestartRequiredFields() = %v, want [port]", fields)
	}

	next.Port = "55000"
	if err := c.Set(next); err != nil {
		t.Fatalf("Set() error = %v", err)
	}
	if fields := c.RestartRequiredFields(); len(fields) != 0 {
		t.Fatalf("reverted port must not require restart, got %v", fields)
	}
}

func TestSetKeepsAutoStart(t *testing.T) {
	useTempDataDir(t)

	c := newDefaultConfig()
	c.AutoStart = false
	next := newDefaultConfig()
	next.AutoStart = true
	if err := c.Set(next); err != nil {
		t.Fatalf("Set() error = %v", err)
	}
	if c.AutoStart {
		t.Fatal("Set must not change AutoStart, it is managed from the tray")
	}
}

func TestSetRejectsInvalid(t *testing.T) {
	c := newDefaultConfig()
	next := newDefaultConfig()
	next.UpdateInterval = 1
	if err := c.Set(next); !errors.Is(err, ErrInvalidConfig) {
		t.Fatalf("Set() error = %v, want ErrInvalidConfig", err)
	}
	if c.UpdateInterval != DefaultUpdateInterval {
		t.Fatal("invalid config must not be applied")
	}
}

func TestMigrateLegacyConfigsPath(t *testing.T) {
	dataDir := useTempDataDir(t)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		t.Fatal(err)
	}

	legacyFile := filepath.Join(dataDir, "my-configs.txt")
	if err := os.WriteFile(legacyFile, []byte("vless://a\n"), 0644); err != nil {
		t.Fatal(err)
	}

	migrated, err := migrateLegacyConfigsPath([]byte(`{"configs_path": "some/dir/my-configs.txt"}`))
	if err != nil || !migrated {
		t.Fatalf("migrateLegacyConfigsPath() = %v, %v; want true, nil", migrated, err)
	}

	data, err := os.ReadFile(filepath.Join(dataDir, ConfigsFileName))
	if err != nil || string(data) != "vless://a\n" {
		t.Fatalf("configs were not moved to the default file: %q, %v", data, err)
	}
}

func TestMigrateLegacyConfigsPathNeverOverwrites(t *testing.T) {
	dataDir := useTempDataDir(t)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		t.Fatal(err)
	}

	current := filepath.Join(dataDir, ConfigsFileName)
	if err := os.WriteFile(current, []byte("current\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "old.txt"), []byte("old\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if _, err := migrateLegacyConfigsPath([]byte(`{"configs_path": "old.txt"}`)); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(current)
	if err != nil || string(data) != "current\n" {
		t.Fatalf("existing configs file was overwritten: %q, %v", data, err)
	}
}

func TestMigrateWithoutLegacyKey(t *testing.T) {
	migrated, err := migrateLegacyConfigsPath([]byte(`{"port": "55000"}`))
	if err != nil || migrated {
		t.Fatalf("migrateLegacyConfigsPath() = %v, %v; want false, nil", migrated, err)
	}
}
