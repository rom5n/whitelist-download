package aggregator

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
)

var (
	// intervalUnit is the unit of Config.UpdateInterval. Tests shorten it.
	intervalUnit = time.Minute
	// retryDelay is the pause before the next attempt after a failed update. Tests shorten it.
	retryDelay = 30 * time.Second
)

// pollFunc runs one configs update with the given (safe copy of the) config.
type pollFunc func(ctx context.Context, cfgSafe *config.Config) (*UpdateResult, error)

func StartPollingConfigs(ctx context.Context, wg *sync.WaitGroup, cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator, scheduler *Scheduler) {
	defer wg.Done()

	runPollingLoop(ctx, cfg, scheduler, func(ctx context.Context, cfgSafe *config.Config) (*UpdateResult, error) {
		return poll(ctx, cfgSafe, configsCache, locator)
	}, func(result *UpdateResult) {
		updateStatistics(result, statistics)
	})
}

// runPollingLoop updates configs on schedule until ctx is cancelled. The next update is due UpdateInterval
// after the previous one, so changing the interval or pausing and resuming updates reschedules it.
// After a pause ends, configs are updated right away.
func runPollingLoop(ctx context.Context, cfg *config.Config, scheduler *Scheduler, pollOnce pollFunc, onResult func(*UpdateResult)) {
	var lastRun time.Time // Zero: update as soon as possible

	for {
		// Check context before starting new actions
		if ctx.Err() != nil {
			return
		}

		if state := scheduler.State(); state.Paused {
			logging.Log.Debug("configs auto update is paused", zap.Bool("forever", state.Forever), zap.Int64("until", state.PausedUntil))
			if !scheduler.waitForResume(ctx, state) {
				logging.Log.Debug("stopping polling configs due to context cancellation")
				return
			}
			lastRun = time.Time{}
			continue
		}

		cfgSafe := cfg.RetrieveSafe(config.Sources, config.UpdateInterval, config.WorkingCheckLevel)

		if !lastRun.IsZero() {
			interval := time.Duration(max(cfgSafe.UpdateInterval, 1)) * intervalUnit
			if wait := time.Until(lastRun.Add(interval)); wait > 0 {
				if !scheduler.wait(ctx, wait) {
					logging.Log.Debug("stopping polling configs due to context cancellation")
					return
				}
				// Woken up by the timer or by a change of the pause or the interval: check again
				continue
			}
		}

		result, err := pollOnce(ctx, cfgSafe)
		if ctx.Err() != nil {
			// The update was interrupted by the shutdown, it is not a failure
			return
		}

		scheduler.ReportUpdate(UpdateEvent{Result: result, Err: err})

		if err != nil {
			logging.Log.Error("failed to update configs, trying again soon...", zap.Duration("delay", retryDelay), zap.Error(err))
			if !scheduler.wait(ctx, retryDelay) {
				logging.Log.Debug("stopping polling configs due to context cancellation")
				return
			}
			continue
		}
		logging.Log.Info("update results", zap.Int("updated configs", result.AmountConfigs), zap.Int("copies skipped", result.Copies), zap.Int("Isn't working skipped", result.NotWorking), zap.Int("Working level", cfgSafe.WorkingCheckLevel))

		onResult(result)
		lastRun = time.Now()
	}
}

func poll(ctx context.Context, cfgSafe *config.Config, configsCache *domain.SafeConfigsCache, locator *geo_ip.Locator) (*UpdateResult, error) {
	sources := cfgSafe.Sources
	workingCheckLevel := cfgSafe.WorkingCheckLevel

	logging.Log.Info("starting polling configs")
	result, err := UpdateConfigs(ctx, configsCache, sources, locator, workingCheckLevel)
	if err != nil {
		return nil, fmt.Errorf("polling configs: %w", err)
	}

	return result, nil
}

func updateStatistics(result *UpdateResult, statistics *domain.Statistics) {
	var newStatistics domain.Statistics
	newStatistics.LastUpdate = time.Now().Unix()
	newStatistics.AmountConfigs = result.AmountConfigs
	newStatistics.ConfigsByCountry = result.ConfigsByCountry

	statistics.Set(&newStatistics)
}
