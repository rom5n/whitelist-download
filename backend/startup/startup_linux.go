package startup

import (
	"fmt"
	"os"
	"path/filepath"
)

func desktopFilePath(appName string) (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user home directory: %w", err)
	}
	return filepath.Join(homeDir, ".config", "autostart", appName+".desktop"), nil
}

func enable(appName string) error {
	exePath, err := executablePath()
	if err != nil {
		return err
	}

	desktopFile, err := desktopFilePath(appName)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(desktopFile), 0755); err != nil {
		return fmt.Errorf("failed to create autostart directory: %w", err)
	}

	desktopContent := fmt.Sprintf(`[Desktop Entry]
Type=Application
Exec=%s
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=%s
Comment=Started automatically by Go program
`, exePath, appName)

	if err := os.WriteFile(desktopFile, []byte(desktopContent), 0644); err != nil {
		return fmt.Errorf("failed to write .desktop file: %w", err)
	}

	return nil
}

func disable(appName string) error {
	desktopFile, err := desktopFilePath(appName)
	if err != nil {
		return err
	}
	if err := removeIfExists(desktopFile); err != nil {
		return fmt.Errorf("failed to remove .desktop file: %w", err)
	}
	return nil
}

func isEnabled(appName string) (bool, error) {
	desktopFile, err := desktopFilePath(appName)
	if err != nil {
		return false, err
	}
	return fileExists(desktopFile)
}
