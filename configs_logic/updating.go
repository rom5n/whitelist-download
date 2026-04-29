package configs_logic

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rom5n/whitelist-download/domain"
	"github.com/rom5n/whitelist-download/geo_ip"
)

const (
	pingTimeout = 2 * time.Second
	maxWorkers  = 150
)

func updateConfigs(configsPath string, configsCache *domain.SafeConfigsCache, statistic *domain.Statistic, sources []string, locator *geo_ip.Locator) error {
	log.Println("getting configs")
	configs, copies := getConfigs(sources)

	log.Println("checking configs for availability")
	workingConfigs := filterWorkingConfigs(configs)

	log.Println("formatting configs")
	formattedConfigs, configsByCountry := formatConfigs(workingConfigs, locator)

	log.Println("updating cache and file")
	if err := updateCacheAndFile(formattedConfigs, configsCache, configsPath); err != nil {
		return err
	}

	update := &domain.Statistic{LastUpdate: time.Now().Unix(), AmountConfigs: len(formattedConfigs), ConfigsByCountry: configsByCountry, StartedAt: statistic.StartedAt}
	statistic.Set(update)

	log.Printf("updated configs: %v. copies skipped: %v. Isn't working skipped: %v\n", len(formattedConfigs), copies, len(configs)-len(workingConfigs))
	return nil
}

func isWorking(link string, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", link, timeout)
	if err != nil {
		return false
	}

	if conn != nil {
		defer conn.Close()
		return true
	}

	return false
}

func getConfigs(sources []string) ([]string, int) {
	unique := make(map[string]struct{})
	uniqueConfigs := make([]string, 0, 4000)
	var copies int

	for _, source := range sources {
		func() {
			resp, err := http.Get(source)
			if err != nil {
				log.Println("error while downloading configs from source:", source, "error:", err)
				return
			}
			defer resp.Body.Close()

			scan := bufio.NewScanner(resp.Body)
			for scan.Scan() {
				config := strings.TrimSpace(scan.Text())
				is, err := isCopy(config, unique)
				if err != nil {
					return
				}
				if is {
					copies++
				}

				uniqueConfigs = append(uniqueConfigs, config)
			}
		}()
	}

	return uniqueConfigs, copies
}

// filterWorkingConfigs returns only working configs
func filterWorkingConfigs(uniqueConfigs []string) []string {
	workingConfigs := make([]string, 0, len(uniqueConfigs))
	var mu sync.Mutex
	var wg sync.WaitGroup
	workersCh := make(chan struct{}, maxWorkers)

	for _, config := range uniqueConfigs {
		wg.Add(1)

		go func() {
			defer wg.Done()

			workersCh <- struct{}{}
			parsedConfig, err := url.Parse(config)
			if err != nil {
				log.Printf("failed to parse unique config. error: %v", err)
				return
			}

			defer func() {
				<-workersCh
			}()

			if isWorking(parsedConfig.Host, pingTimeout) {
				mu.Lock()
				defer mu.Unlock()
				workingConfigs = append(workingConfigs, config)
			}
		}()
	}

	wg.Wait()
	return workingConfigs
}

func formatConfigs(workingConfigs []string, locator *geo_ip.Locator) ([]string, map[string]int) {
	var mu sync.Mutex
	var wg sync.WaitGroup
	workersCh := make(chan struct{}, maxWorkers)
	formattedConfigs := make([]string, 0, len(workingConfigs))
	configsByCountry := make(map[string]int)

	for i, config := range workingConfigs {
		go func() {
			wg.Add(1)
			defer wg.Done()
			workersCh <- struct{}{}
			defer func() {
				<-workersCh
			}()

			parsedConfig, err := url.Parse(config)
			if err != nil {
				log.Printf("failed to parse working config. error: %v", err)
				return
			}

			name, flag := locator.GetCountryNameAndFlag(parsedConfig.Hostname())
			formatName(parsedConfig, name, flag, i)
			configsByCountry[name]++

			mu.Lock()
			defer mu.Unlock()
			formattedConfigs = append(formattedConfigs, parsedConfig.String())
		}()
	}

	wg.Wait()
	return formattedConfigs, configsByCountry
}

func formatName(parsedConfig *url.URL, name string, flag string, i int) {
	var builder strings.Builder

	builder.WriteString(flag)
	builder.WriteString(" ")
	builder.WriteString(name)
	builder.WriteString(" ")
	builder.WriteString("—")
	builder.WriteString(" ")
	builder.WriteString("#")
	builder.WriteString(strconv.Itoa(i + 1))

	parsedConfig.Fragment = builder.String()
}

func updateCacheAndFile(configs []string, configsCache *domain.SafeConfigsCache, configsPath string) error {
	if len(configs) > 0 {
		configsCache.Set(configs)

		data := []byte(strings.Join(configs, "\n") + "\n")

		tmpPath := configsPath + ".tmp"

		err := os.WriteFile(tmpPath, data, 0666)
		if err != nil {
			log.Println("failed to write temporary file:", err)
			return err
		}

		err = os.Rename(tmpPath, configsPath)
		if err != nil {
			log.Println("failed to replace configs file:", err)
			return err
		}

		return nil
	}

	return fmt.Errorf("no configs to update")
}

func isCopy(config string, unique map[string]struct{}) (bool, error) {
	parsedConfig, err := url.Parse(config)
	if err != nil {
		log.Printf("failed to parse dirty config. error: %v", err)
		return false, fmt.Errorf("failed to parse dirty config. error: %v", err)
	}

	parsedConfig.Fragment = ""
	configWithoutName := parsedConfig.String()
	if _, exists := unique[configWithoutName]; !exists && parsedConfig.Scheme == "vless" {
		unique[configWithoutName] = struct{}{}
		return false, nil
	}

	return true, nil
}
