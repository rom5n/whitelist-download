package startup

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

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
