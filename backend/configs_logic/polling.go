package configs_logic

import (
	"log"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
)

func StartPollingConfigs(cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) {
	for {
		cfg.RLock()
		configsPath := cfg.ConfigsPath
		sources := cfg.Sources
		timeout := cfg.UpdateInterval
		cfg.RUnlock()

		log.Println("starting polling configs")
		result, err := UpdateConfigs(configsPath, configsCache, sources, locator)
		if err != nil {
			log.Println("failed to update configs, trying again in 30 seconds...")
			time.Sleep(30 * time.Second)
			continue
		}

		update := &domain.Statistics{LastUpdate: time.Now().Unix(), AmountConfigs: result.AmountConfigs, ConfigsByCountry: result.ConfigsByCountry}
		statistics.Set(update)

		log.Printf("updated configs: %v. copies skipped: %v. Isn't working skipped: %v\n", result.AmountConfigs, result.Copies, result.NotWorking)

		log.Printf("configs updated successfully\n")
		time.Sleep(time.Duration(timeout) * time.Minute)
	}
}
