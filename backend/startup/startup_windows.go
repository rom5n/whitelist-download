package startup

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/rom5n/whitelist-download/backend/config"
	"golang.org/x/sys/windows/registry"
)

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

		key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
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
		log.Printf("failed to add to startup: %v\n", err)
	} else {
		log.Println("added to startup")
	}
}
