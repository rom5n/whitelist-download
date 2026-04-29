package configs_logic

import (
	"log"
	"time"

	"github.com/rom5n/whitelist-download/domain"
	"github.com/rom5n/whitelist-download/geo_ip"
)

func StartPollingConfigs(configsPath string, configsCache *domain.SafeConfigsCache, statistic *domain.Statistic, sources []string, locator *geo_ip.Locator) {
	for {
		log.Println("starting polling configs")
		if err := updateConfigs(configsPath, configsCache, statistic, sources, locator); err != nil {
			log.Println("failed to update configs, trying again in 30 seconds...")
			time.Sleep(30 * time.Second)
			continue
		}

		log.Printf("configs updated successfully\n")
		time.Sleep(1 * time.Hour)
	}
}
