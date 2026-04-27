package configs_logic

import (
	"bufio"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/rom5n/whitelist-download/domain"
)

func updateConfigs(configsPath string, configsCache *domain.SafeConfigsCache, sources []string) (errNum int) {
	unique := make(map[string]struct{})
	copies := 0
	configs := make([]string, 0, 4000)

	for _, source := range sources {
		func() {
			resp, err := http.Get(source)
			if err != nil {
				log.Println("error while downloading configs from source:", source, "error:", err)
				errNum++
				return
			}
			defer resp.Body.Close()

			scan := bufio.NewScanner(resp.Body)
			for scan.Scan() {
				config := strings.TrimSpace(scan.Text())
				parsedConfig, err := url.Parse(config)
				if err != nil {
					log.Printf("failed to parse config. error: %v", err)
					continue
				}

				parsedConfig.Fragment = ""
				configWithoutName := parsedConfig.String()
				if _, exists := unique[configWithoutName]; !exists && parsedConfig.Scheme == "vless" {
					configs = append(configs, config)
					unique[configWithoutName] = struct{}{}
					continue
				}
				copies++
			}
		}()
	}

	if len(configs) > 0 {
		configsCache.Set(configs)

		data := []byte(strings.Join(configs, "\n") + "\n")

		tmpPath := configsPath + ".tmp"

		err := os.WriteFile(tmpPath, data, 0666)
		if err != nil {
			log.Println("failed to write temporary file:", err)
			return errNum
		}

		err = os.Rename(tmpPath, configsPath)
		if err != nil {
			log.Println("failed to replace configs file:", err)
		}
	}

	log.Printf("updated configs: %v. copies skipped: %v\n", len(configs), copies)
	return errNum
}
