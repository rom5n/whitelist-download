package startup

func Add(appName string) {
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

		desktopFilePath := filepath.Join(autostartDir, appName+".desktop")

		desktopContent := fmt.Sprintf(`[Desktop Entry]
Type=Application
Exec=%s
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=%s
Comment=Started automatically by Go program
`, exePath, appName)

		err = os.WriteFile(desktopFilePath, []byte(desktopContent), 0644)
		if err != nil {
			return fmt.Errorf("failed to write .desktop file: %w", err)
		}

		return nil
	}()

	if err != nil {
		log.Printf("failed to add to startup: %v\n", err)
	} else {
		log.Println("added to startup")
	}
}
