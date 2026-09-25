package main

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/browser"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/http"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/startup"
	"github.com/rom5n/whitelist-download/backend/updater"
)

var version = "dev"

func main() {
	time.Sleep(10 * time.Second)
	ctx, cancel := context.WithCancel(context.Background())
	ctx = context.WithValue(ctx, "version", version)
	setExecutableDir()

	logging.Initialize()
	defer logging.Log.Sync()

	cfg := config.Load()
	startup.Apply(cfg)

	configsCache := &domain.SafeConfigsCache{}
	statistics := &domain.Statistics{StartedAt: time.Now().Unix(), Version: version, UpdateInterval: cfg.UpdateInterval}
	locator := geo_ip.InitLocator()
	updaterState := &domain.SafeUpdaterState{}
	scheduler := aggregator.NewScheduler(cfg, statistics)

	go handleShutdown(cancel)

	startApp := func() {
		var wg sync.WaitGroup

		wg.Add(1)
		go aggregator.StartPollingConfigs(ctx, &wg, cfg, configsCache, statistics, locator, scheduler)

		browser.Open(cfg.Port, cfg.AutoBrowserOpen)

		wg.Add(1)
		go func() {
			defer wg.Done()
			updater.Start(ctx, cfg, updaterState, cancel)
		}()

		wg.Add(1)
		http.Start(ctx, cancel, &wg, cfg, configsCache, statistics, locator, updaterState, scheduler)

		logging.Log.Info("waiting for tasks to finish...")
		wg.Wait()
		logging.Log.Info("graceful shutdown completed")
	}

	run(ctx, cancel, cfg, statistics, scheduler, updaterState, startApp)
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
			logging.Log.Error("failed to change the executable directory name", zap.Error(err))
			os.Exit(1)
		}
		os.Remove(exePath + ".old")
	}
}
