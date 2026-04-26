package configs_logic

import (
	"bufio"
	"log"
	"net/http"
	"strings"

	"github.com/rom5n/whitelist-download/domain"
)

func updateConfigs(configsFile *domain.SafeFile, configsCache *domain.SafeConfigsCache, sources []string) (errNum int) {
	unique := make(map[string]struct{})
	copies := 0
	configs := make([]string, 0, 4000)

	for _, source := range sources {
		resp, err := http.Get(source)
		if err != nil {
			log.Println("error while downloading configs from source:", source, "error:", err)
			errNum++
		}

		defer resp.Body.Close()

		scan := bufio.NewScanner(resp.Body)
		writer := bufio.NewWriterSize(configsFile, 64*1024)

		for scan.Scan() {
			text := scan.Text()

			if _, exists := unique[text]; !exists && strings.HasPrefix(text, "vless://") {
				writer.WriteString(text + "\n")
				configs = append(configs, text)
				unique[text] = struct{}{}
				continue
			}
			copies++
		}

		configsCache.Set(configs)
		writer.Flush()
	}

	log.Printf("updated configs: %v. copies skipped: %v\n", len(configs), copies)

	return errNum
}
