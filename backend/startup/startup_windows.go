package startup

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"github.com/rom5n/whitelist-download/backend/config"
	"golang.org/x/sys/windows/registry"
)

const runKeyPath = `Software\Microsoft\Windows\CurrentVersion\Run`

// Remove deletes the app from the autostart.
func Remove(cfg *config.Config) {
	err := func() error {
		appName := cfg.RetrieveSafe(config.AppName).AppName

		key, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("failed to open registry key: %w", err)
		}
		defer key.Close()

		if err = key.DeleteValue(appName); err != nil && !errors.Is(err, registry.ErrNotExist) {
			return fmt.Errorf("failed to delete registry value: %w", err)
		}

		return nil
	}()

	if err != nil {
		logging.Log.Error("failed to remove from startup", zap.Error(err))
	} else {
		logging.Log.Info("removed from startup")
	}
}

func Add(cfg *config.Config) {
	err := func() error {
		cfgSafe := cfg.RetrieveSafe(config.AppName)
		appName := cfgSafe.AppName

		exePath, err := os.Executable()
		if err != nil {
			return fmt.Errorf("failed to get executable file path: %w", err)
		}

		exePath, err = filepath.Abs(exePath)
		if err != nil {
			return fmt.Errorf("failed to get absolute path of executable: %w", err)
		}

		key, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("failed to open registry key: %w", err)
		}
		defer key.Close()

		err = key.SetStringValue(appName, exePath)
		if err != nil {
			return fmt.Errorf("failed to write to registry: %w", err)
		}

		return nil
	}()

	if err != nil {
		logging.Log.Error("failed to add to startup", zap.Error(err))
	} else {
		logging.Log.Info("added to startup")
	}
}
