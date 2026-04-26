package configs_logic

import (
	"log"
	"time"

	"github.com/rom5n/whitelist-download/domain"
)

func StartPollingConfigs(configsFile *domain.SafeFile, configs string, configsCache *domain.SafeConfigsCache, sources []string) {
	for {
		resetFile(configsFile, configs)

		if errNum := updateConfigs(configsFile, configsCache, sources); errNum == len(sources) {
			log.Println("too many errors, trying again...")
			continue
		}

		log.Printf("%v updated\n", configs)

		time.Sleep(1 * time.Hour)
	}
}

func resetFile(file *domain.SafeFile, name string) {
	if err := file.Truncate(0); err != nil {
		log.Println("failed to truncate file:", name, "error:", err)
	}

	if _, err := file.Seek(0, 0); err != nil {
		log.Println("failed to seek file:", name, "error:", err)
	}
}
