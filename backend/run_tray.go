//go:build !headless

package main

import (
	"context"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/tray"
)

// run starts the app from the system tray; it blocks until the app quits.
func run(ctx context.Context, cancel context.CancelFunc, cfg *config.Config, statistics *domain.Statistics, scheduler *aggregator.Scheduler, updaterState *domain.SafeUpdaterState, startApp func()) {
	tray.Run(ctx, cancel, cfg, statistics, scheduler, updaterState, startApp)
}
