//go:build headless

package main

import (
	"context"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
)

// run starts the app without the system tray (servers and Docker, where there is no desktop and no cgo);
// it blocks until the app shuts down (SIGINT/SIGTERM).
func run(_ context.Context, _ context.CancelFunc, _ *config.Config, _ *domain.Statistics, _ *aggregator.Scheduler, _ *domain.SafeUpdaterState, startApp func()) {
	startApp()
}
