package startup

import (
	"fmt"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"os"
	"path/filepath"

	"github.com/rom5n/whitelist-download/backend/config"
)

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

		autostartDir := filepath.Join(homeDir, "Library", "LaunchAgents")

		if err := os.MkdirAll(autostartDir, 0755); err != nil {
			return fmt.Errorf("failed to create autostart directory: %w", err)
		}

		plistFilePath := filepath.Join(autostartDir, cfg.AppName+".plist")

		plistContent := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>%s</string>
	<key>ProgramArguments</key>
	<array>
		<string>%s</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
</dict>
</plist>
`, cfg.AppName, exePath)

		err = os.WriteFile(plistFilePath, []byte(plistContent), 0644)
		if err != nil {
			return fmt.Errorf("failed to write .plist file: %w", err)
		}

		return nil
	}()

	if err != nil {
		logging.Log.Error("failed to add to startup", zap.Error(err))
	} else {
		logging.Log.Info("added to startup")
	}
}
