//go:build linux || darwin

package startup

import (
	"os"
	"testing"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

func TestMain(m *testing.M) {
	logging.Log = zap.NewNop()
	os.Exit(m.Run())
}

func TestApplyTogglesAutostart(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	const appName = "WhitelistDownloadTest"

	for _, want := range []bool{true, false, false, true} {
		if err := Apply(appName, want); err != nil {
			t.Fatalf("Apply(%v) error = %v", want, err)
		}
		got, err := IsEnabled(appName)
		if err != nil {
			t.Fatalf("IsEnabled() error = %v", err)
		}
		if got != want {
			t.Fatalf("IsEnabled() = %v after Apply(%v)", got, want)
		}
	}
}
