package startup

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"github.com/rom5n/whitelist-download/backend/config"
)

// Remove deletes the app from the autostart.
func Remove(cfg *config.Config) {
	err := func() error {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to get user home directory: %w", err)
		}

		appName := cfg.RetrieveSafe(config.AppName).AppName
		desktopFilePath := filepath.Join(homeDir, ".config", "autostart", appName+".desktop")

		if err = os.Remove(desktopFilePath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to remove .desktop file: %w", err)
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
		exePath, err := os.Executable()
		if err != nil {
			return fmt.Errorf("failed to get executable file path: %w", err)
		}

		exePath, err = filepath.Abs(exePath)
		if err != nil {
			return fmt.Errorf("failed to get absolute path of executable: %w", err)
		}

		homeDir, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to get user home directory: %w", err)
		}

		autostartDir := filepath.Join(homeDir, ".config", "autostart")

		if err := os.MkdirAll(autostartDir, 0755); err != nil {
			return fmt.Errorf("failed to create autostart directory: %w", err)
		}

		desktopFilePath := filepath.Join(autostartDir, cfg.AppName+".desktop")

		desktopContent := fmt.Sprintf(`[Desktop Entry]
Type=Application
Exec=%s
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=%s
Comment=Started automatically by Go program
`, exePath, cfg.AppName)

		err = os.WriteFile(desktopFilePath, []byte(desktopContent), 0644)
		if err != nil {
			return fmt.Errorf("failed to write .desktop file: %w", err)
		}

		return nil
	}()

	if err != nil {
		logging.Log.Error("failed to add to startup", zap.Error(err))
	} else {
		logging.Log.Info("added to startup")
	}
}
