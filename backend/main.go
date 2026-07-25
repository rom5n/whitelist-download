package main

import (
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"time"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/http"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/startup"
)

func main() {
	time.Sleep(10 * time.Second)
	logging.Initialize()
	defer logging.Log.Sync()

	setExecutableDir()

	cfg := config.Load()
	startup.Add(cfg)

	configsCache := &domain.SafeConfigsCache{}
	statistics := &domain.Statistics{StartedAt: time.Now().Unix()}
	locator := geo_ip.InitLocator()

	go aggregator.StartPollingConfigs(cfg, configsCache, statistics, locator)

	http.Start(cfg, configsCache, statistics, locator)
}

func setExecutableDir() {
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		if err = os.Chdir(exeDir); err != nil {
			logging.Log.Fatal("failed to change the executable directory name", zap.Error(err))
		}
	}
}
