package startup

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// Apply makes the OS autostart entry match the desired state
func Apply(appName string, enabled bool) error {
	if enabled {
		if err := enable(appName); err != nil {
			return fmt.Errorf("enable autostart: %w", err)
		}
		logging.Log.Info("autostart enabled")
		return nil
	}

	if err := disable(appName); err != nil {
		return fmt.Errorf("disable autostart: %w", err)
	}
	logging.Log.Info("autostart disabled")
	return nil
}

// IsEnabled reports whether the OS autostart entry for the app exists
func IsEnabled(appName string) (bool, error) {
	return isEnabled(appName)
}

// Sync applies the saved preference on app start and logs failures instead of stopping the app
func Sync(appName string, enabled bool) {
	if err := Apply(appName, enabled); err != nil {
		logging.Log.Error("failed to sync autostart state", zap.Error(err), zap.Bool("enabled", enabled))
	}
}

func executablePath() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable file path: %w", err)
	}

	exePath, err = filepath.Abs(exePath)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path of executable: %w", err)
	}

	return exePath, nil
}

func removeIfExists(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func fileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}
