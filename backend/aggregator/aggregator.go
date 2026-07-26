package aggregator

import (
	"context"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"sync"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
)

func StartPollingConfigs(ctx context.Context, wg *sync.WaitGroup, cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) {
	defer wg.Done()
	for {
		// Check context before starting new actions
		if ctx.Err() != nil {
			logging.Log.Info("stopping polling configs due to context cancellation")
			return
		}

		cfgSafe := cfg.RetrieveSafe(config.ConfigsPath, config.Sources, config.UpdateInterval, config.WorkingCheckLevel)
		configsPath := cfgSafe.ConfigsPath
		sources := cfgSafe.Sources
		timeout := cfgSafe.UpdateInterval
		workingCheckLevel := cfgSafe.WorkingCheckLevel

		logging.Log.Info("starting polling configs")
		result, err := UpdateConfigs(ctx, configsPath, configsCache, sources, locator, workingCheckLevel)
		if err != nil {
			logging.Log.Error("failed to update configs, trying again in 30 seconds...", zap.Error(err))
			select {
			case <-ctx.Done():
				logging.Log.Info("stopping polling configs due to context cancellation")
				return
			case <-time.After(30 * time.Second):
				continue
			}
		}

		update := &domain.Statistics{LastUpdate: time.Now().Unix(), AmountConfigs: result.AmountConfigs, ConfigsByCountry: result.ConfigsByCountry}
		statistics.Set(update)

		logging.Log.Info("update results", zap.Int("updated configs", result.AmountConfigs), zap.Int("copies skipped", result.Copies), zap.Int("Isn't working skipped", result.NotWorking), zap.Int("Working level", workingCheckLevel))

		logging.Log.Info("configs updated successfully")
		
		select {
		case <-ctx.Done():
			logging.Log.Info("stopping polling configs due to context cancellation")
			return
		case <-time.After(time.Duration(timeout) * time.Minute):
		}
	}
}
