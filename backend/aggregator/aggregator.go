package aggregator

import (
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
)

func StartPollingConfigs(cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) {
	for {
		cfgSafe := cfg.RetrieveSafe(config.ConfigsPath, config.Sources, config.UpdateInterval, config.WorkingCheckLevel)
		configsPath := cfgSafe.ConfigsPath
		sources := cfgSafe.Sources
		timeout := cfgSafe.UpdateInterval
		workingCheckLevel := cfgSafe.WorkingCheckLevel

		logging.Log.Info("starting polling configs")
		result, err := UpdateConfigs(configsPath, configsCache, sources, locator, workingCheckLevel)
		if err != nil {
			logging.Log.Error("failed to update configs, trying again in 30 seconds...", zap.Error(err))
			time.Sleep(30 * time.Second)
			continue
		}

		update := &domain.Statistics{LastUpdate: time.Now().Unix(), AmountConfigs: result.AmountConfigs, ConfigsByCountry: result.ConfigsByCountry}
		statistics.Set(update)

		logging.Log.Info("update results", zap.Int("updated configs", result.AmountConfigs), zap.Int("copies skipped", result.Copies), zap.Int("Isn't working skipped", result.NotWorking))

		logging.Log.Info("configs updated successfully")
		time.Sleep(time.Duration(timeout) * time.Minute)
	}
}
