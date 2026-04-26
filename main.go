package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/rom5n/whitelist-download/config"
	"github.com/rom5n/whitelist-download/configs_logic"
	"github.com/rom5n/whitelist-download/domain"
	server "github.com/rom5n/whitelist-download/http"
	"github.com/rom5n/whitelist-download/logging"
	"golang.org/x/sys/windows/registry"
)

func addToStartup(appName string) {
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

func GetSources(filepath string) []string {
	file, err := os.OpenFile(filepath, os.O_RDONLY, 0666)
	if err != nil {
		log.Fatalf("error opening %v: %v\n", filepath, err)
	}

	unique := make(map[string]struct{})

	scan := bufio.NewScanner(file)

	sources := make([]string, 0)

	for scan.Scan() {
		text := scan.Text()

		if _, exists := unique[text]; !exists {
			sources = append(sources, text)
		}
	}

	return sources
}

func main() {
	cfg := config.GetConfig()

	configsFile := domain.GetFile(cfg.Configs)
	configsCache := &domain.SafeConfigsCache{}
	sources := GetSources(cfg.Sources)

	logging.ConfigureLogging(cfg.Logs)

	addToStartup(cfg.AppName)

	go configs_logic.StartPollingConfigs(configsFile, cfg.Configs, configsCache, sources)

	server.StartHttpSubscriptionServer(configsFile, configsCache, cfg.SubPath, cfg.Port, cfg.SubscriptionTitle, cfg.DescriptionText)
}
