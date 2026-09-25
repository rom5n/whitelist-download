package config

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/adrg/xdg"
	"github.com/goccy/go-json"
	"github.com/rom5n/whitelist-download/backend/internal/testenv"
	"github.com/rom5n/whitelist-download/backend/paths"
)

func TestSetKeepsPause(t *testing.T) {
	testenv.Isolate(t)

	cfg := newDefaultConfig()
	if err := cfg.SetPausedUntil(PausedForever); err != nil {
		t.Fatalf("SetPausedUntil: %v", err)
	}

	// A settings form loaded before the pause carries PausedUntil == 0.
	stale := newDefaultConfig()
	stale.SubscriptionTitle = "changed"
	if err := cfg.Set(stale); err != nil {
		t.Fatalf("Set: %v", err)
	}

	if got := cfg.RetrieveSafe(PausedUntil).PausedUntil; got != PausedForever {
		t.Errorf("Set changed the pause: PausedUntil = %d", got)
	}
	if got := cfg.RetrieveSafe(SubscriptionTitle).SubscriptionTitle; got != "changed" {
		t.Errorf("Set did not apply other fields: SubscriptionTitle = %q", got)
	}
}

func TestDefaults(t *testing.T) {
	cfg := newDefaultConfig()

	if !cfg.AutoStart || !cfg.Notifications || cfg.Language != LanguageAuto || cfg.PausedUntil != 0 {
		t.Errorf("unexpected defaults: %+v", cfg)
	}
}

func TestSetKeepsTrayManagedFields(t *testing.T) {
	testenv.Isolate(t)

	cfg := newDefaultConfig()
	if err := cfg.SetAutoStart(false); err != nil {
		t.Fatal(err)
	}
	if err := cfg.SetNotifications(false); err != nil {
		t.Fatal(err)
	}
	if err := cfg.SetLanguage(LanguageRU); err != nil {
		t.Fatal(err)
	}

	// A settings form loaded from an older version does not know these fields
	stale := &Config{Port: "55000", UpdateInterval: 30}
	if err := cfg.Set(stale); err != nil {
		t.Fatal(err)
	}

	got := cfg.RetrieveSafe(AutoStart, Notifications, Language, UpdateInterval)
	if got.AutoStart || got.Notifications || got.Language != LanguageRU {
		t.Errorf("Set overwrote tray-managed fields: %+v", got)
	}
	if got.UpdateInterval != 30 {
		t.Errorf("Set did not apply UpdateInterval: %d", got.UpdateInterval)
	}
}

func TestSettersValidateAndPersist(t *testing.T) {
	testenv.Isolate(t)

	cfg := newDefaultConfig()

	if err := cfg.SetLanguage("klingon"); !errors.Is(err, ErrInvalidLanguage) {
		t.Errorf("SetLanguage(klingon) error = %v, want ErrInvalidLanguage", err)
	}
	if cfg.Language != LanguageAuto {
		t.Errorf("invalid language changed the config to %q", cfg.Language)
	}

	if err := cfg.SetUpdateInterval(0); !errors.Is(err, ErrInvalidInterval) {
		t.Errorf("SetUpdateInterval(0) error = %v, want ErrInvalidInterval", err)
	}
	if cfg.UpdateInterval != 15 {
		t.Errorf("invalid interval changed the config to %d", cfg.UpdateInterval)
	}

	if err := cfg.SetUpdateInterval(360); err != nil {
		t.Fatal(err)
	}

	// The saved file must load back with the new values
	loaded := newDefaultConfig()
	path, err := xdg.ConfigFile("whitelist-download/config.json")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(data, loaded); err != nil {
		t.Fatal(err)
	}
	if loaded.UpdateInterval != 360 {
		t.Errorf("saved interval = %d, want 360", loaded.UpdateInterval)
	}
}

func TestMigrateConfigsPath(t *testing.T) {
	testenv.Isolate(t)

	dataFile := func(name string) string {
		path, err := xdg.DataFile(filepath.Join("whitelist-download", name))
		if err != nil {
			t.Fatal(err)
		}
		return path
	}
	if err := os.WriteFile(dataFile("custom.txt"), []byte("vless://a\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	migrateConfigsPath([]byte(`{"configs_path": "custom.txt"}`))

	data, err := os.ReadFile(dataFile(paths.ConfigsFileName))
	if err != nil || string(data) != "vless://a\n" {
		t.Fatalf("configs file was not migrated: %q, %v", data, err)
	}
	if _, err := os.Stat(dataFile("custom.txt")); !os.IsNotExist(err) {
		t.Errorf("the old configs file is still there: %v", err)
	}

	// An existing configs file is never overwritten
	if err := os.WriteFile(dataFile("other.txt"), []byte("vless://b\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	migrateConfigsPath([]byte(`{"configs_path": "other.txt"}`))
	if data, _ := os.ReadFile(dataFile(paths.ConfigsFileName)); string(data) != "vless://a\n" {
		t.Errorf("the configs file was overwritten: %q", data)
	}

	// Configs without the key, or with the default name, are left alone
	migrateConfigsPath([]byte(`{}`))
	migrateConfigsPath([]byte(`{"configs_path": "configs.txt"}`))
}
