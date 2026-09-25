// Package testenv isolates tests from the developer's real app files.
package testenv

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/adrg/xdg"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// Isolate redirects the XDG config, data and state directories to a temporary directory
// (so config.Save can not touch the real config.json) and replaces the app logger with a no-op one.
func Isolate(t *testing.T) {
	t.Helper()

	dir := t.TempDir()

	// Registered before t.Setenv so that it runs after the environment is restored.
	t.Cleanup(xdg.Reload)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(dir, "config"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(dir, "data"))
	t.Setenv("XDG_STATE_HOME", filepath.Join(dir, "state"))
	xdg.Reload()

	if !strings.HasPrefix(xdg.ConfigHome, dir) {
		t.Fatalf("XDG_CONFIG_HOME override was not applied (config home is %q): refusing to run", xdg.ConfigHome)
	}

	previous := logging.Log
	logging.Log = zap.NewNop()
	t.Cleanup(func() { logging.Log = previous })
}
