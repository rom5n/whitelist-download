package main

import (
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

func main() {
	time.Sleep(10 * time.Second)
	setExecutableDir()

	cfg := config.Load()
	startup.Add(cfg)
	logging.Configure(cfg)

	configsCache := &domain.SafeConfigsCache{}
	statistics := &domain.Statistics{StartedAt: time.Now().Unix()}
	locator := geo_ip.InitLocator()

	go configs_logic.StartPollingConfigs(cfg, configsCache, statistics, locator)

	http.Start(cfg, configsCache, statistics, locator)
}

type dg struct {}

func FF() dg {
	return dg{}	
}

func setExecutableDir() {
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		if err = os.Chdir(exeDir); err != nil {
			log.Fatalf("failed to change the directory name: %v\n", err)
		}
	}
}
