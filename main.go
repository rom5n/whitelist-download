package main

import (
	"bufio"
	"log"
	"os"
	"time"

	"github.com/rom5n/whitelist-download/config"
	"github.com/rom5n/whitelist-download/configs_logic"
	"github.com/rom5n/whitelist-download/domain"
	"github.com/rom5n/whitelist-download/geo_ip"
	"github.com/rom5n/whitelist-download/http"
	"github.com/rom5n/whitelist-download/logging"
	"github.com/rom5n/whitelist-download/startup"
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
