package main

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/configs_logic"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/http"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/startup"
)

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
	time.Sleep(20 * time.Second)
	setExecutableDir()

	cfg := config.GetConfig()

	configsCache := &domain.SafeConfigsCache{}
	sources := GetSources(cfg.Sources)
	locator := geo_ip.InitLocator()
	statistic := &domain.Statistic{StartedAt: time.Now().Unix()}

	logging.ConfigureLogging(cfg.Logs)

	startup.Add(cfg.AppName)

	go configs_logic.StartPollingConfigs(cfg.Configs, configsCache, statistic, sources, locator)

	http.Start(cfg.Configs, configsCache, statistic, cfg.SubPath, cfg.Port, cfg.SubscriptionTitle, cfg.DescriptionText)
}

func setExecutableDir() {
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		os.Chdir(exeDir)
	}
}
