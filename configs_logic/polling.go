package configs_logic

import (
	"log"
	"time"

	"github.com/rom5n/whitelist-download/domain"
)

func StartPollingConfigs(configsPath string, configsCache *domain.SafeConfigsCache, sources []string) {
	for {
		errNum := updateConfigs(configsPath, configsCache, sources)

		if errNum == len(sources) {
			log.Println("too many errors, trying again in 30 seconds...")
			time.Sleep(30 * time.Second)
			continue
		}

		log.Printf("sources updated successfully\n")
		time.Sleep(1 * time.Hour)
	}
}
