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

		cfgSafe := cfg.RetrieveSafe(config.ConfigsPath, config.Sources, config.UpdateInterval, config.WorkingCheckLevel)
		timeout := cfgSafe.UpdateInterval
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

		select {
		case <-ctx.Done():
			logging.Log.Debug("stopping polling configs due to context cancellation")
			return
		case <-time.After(time.Duration(timeout) * time.Minute):
		}
	}
}

func poll(ctx context.Context, cfgSafe *config.Config, configsCache *domain.SafeConfigsCache, locator *geo_ip.Locator) (*UpdateResult, error) {
	configsPath := cfgSafe.ConfigsPath
	sources := cfgSafe.Sources
	workingCheckLevel := cfgSafe.WorkingCheckLevel

	logging.Log.Info("starting polling configs")
	result, err := UpdateConfigs(ctx, configsPath, configsCache, sources, locator, workingCheckLevel)
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
