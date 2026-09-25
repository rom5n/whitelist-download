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

func StartPollingConfigs(ctx context.Context, wg *sync.WaitGroup, cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) {
	defer wg.Done()
	for {
		// Check context before starting new actions
		if ctx.Err() != nil {
			return
		}

		cfgSafe := cfg.RetrieveSafe(config.Sources, config.WorkingCheckLevel)
		startedAt := time.Now()
		workingCheckLevel := cfgSafe.WorkingCheckLevel

		result, err := poll(ctx, cfgSafe, configsCache, locator)
		if err != nil {
			logging.Log.Error("failed to update configs, trying again in 30 seconds...", zap.Error(err))
			select {
			case <-ctx.Done():
				logging.Log.Debug("stopping polling configs due to context cancellation")
				return
			case <-time.After(30 * time.Second):
				continue
			}
		}
		logging.Log.Info("update results", zap.Int("updated configs", result.AmountConfigs), zap.Int("copies skipped", result.Copies), zap.Int("Isn't working skipped", result.NotWorking), zap.Int("Working level", workingCheckLevel))

		updateStatistics(result, statistics)

		if !waitNextPoll(ctx, cfg, startedAt) {
			logging.Log.Debug("stopping polling configs due to context cancellation")
			return
		}
	}
}

// intervalCheckPeriod is how often the poller re-reads the update interval,
// so a changed interval is applied without waiting for the old one to expire
const intervalCheckPeriod = 30 * time.Second

// waitNextPoll blocks until the configured interval has passed since startedAt. Returns false if ctx is done
func waitNextPoll(ctx context.Context, cfg *config.Config, startedAt time.Time) bool {
	for {
		interval := time.Duration(cfg.RetrieveSafe(config.UpdateInterval).UpdateInterval) * time.Minute
		remaining := time.Until(startedAt.Add(interval))
		if remaining <= 0 {
			return true
		}

		select {
		case <-ctx.Done():
			return false
		case <-time.After(min(remaining, intervalCheckPeriod)):
		}
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
	newStatistics.CountryCodes = result.CountryCodes

	statistics.Set(&newStatistics)
}
