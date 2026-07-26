package main

import (
	"context"
	"go.uber.org/zap"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
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
	ctx, cancel := context.WithCancel(context.Background())
	setExecutableDir()
	
	logging.Initialize()
	defer logging.Log.Sync()

	cfg := config.Load()
	startup.Add(cfg)

	configsCache := &domain.SafeConfigsCache{}
	statistics := &domain.Statistics{StartedAt: time.Now().Unix()}
	locator := geo_ip.InitLocator()

	go handleShutdown(cancel)

	var wg sync.WaitGroup

	wg.Add(1)
	go aggregator.StartPollingConfigs(ctx, &wg, cfg, configsCache, statistics, locator)

	wg.Add(1)
	http.Start(ctx, cancel, &wg, cfg, configsCache, statistics, locator)

	logging.Log.Info("waiting for tasks to finish...")
	wg.Wait()
	logging.Log.Info("graceful shutdown completed")
}

// handleShutdown Gracefully handles shutdown
func handleShutdown(cancel context.CancelFunc) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	sig := <-c
	logging.Log.Info("received signal, initiating graceful shutdown", zap.String("signal", sig.String()))
	cancel()
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
