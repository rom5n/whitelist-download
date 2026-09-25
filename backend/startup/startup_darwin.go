package startup

import (
	"fmt"
	"os"
	"path/filepath"
)

func plistFilePath(appName string) (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user home directory: %w", err)
	}
	return filepath.Join(homeDir, "Library", "LaunchAgents", appName+".plist"), nil
}

func enable(appName string) error {
	exePath, err := executablePath()
	if err != nil {
		return err
	}

	plistFile, err := plistFilePath(appName)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(plistFile), 0755); err != nil {
		return fmt.Errorf("failed to create autostart directory: %w", err)
	}

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
`, appName, exePath)

	if err := os.WriteFile(plistFile, []byte(plistContent), 0644); err != nil {
		return fmt.Errorf("failed to write .plist file: %w", err)
	}

	return nil
}

func disable(appName string) error {
	plistFile, err := plistFilePath(appName)
	if err != nil {
		return err
	}
	if err := removeIfExists(plistFile); err != nil {
		return fmt.Errorf("failed to remove .plist file: %w", err)
	}
	return nil
}

func isEnabled(appName string) (bool, error) {
	plistFile, err := plistFilePath(appName)
	if err != nil {
		return false, err
	}
	return fileExists(plistFile)
}
