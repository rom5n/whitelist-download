package configs_logic

import (
	"bufio"
	"context"
	"errors"
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

	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
)

const (
	pingTimeout   = 2 * time.Second
	sourceTimeout = 5 * time.Second
	updateTimeout = 30 * time.Second
	maxWorkers    = 150
)

type UpdateResult struct {
	AmountConfigs    int
	Copies           int
	NotWorking       int
	ConfigsByCountry map[string]int
}

func UpdateConfigs(configsPath string, configsCache *domain.SafeConfigsCache, sources []string, locator *geo_ip.Locator) (*UpdateResult, error) {
	if len(sources) == 0 {
		return nil, errors.New("no sources provided")
	}

	ctx, cancel := context.WithTimeout(context.Background(), updateTimeout)
	defer cancel()

	log.Println("getting configs")
	configs, copies, err := getConfigs(ctx, sources)
	if err != nil {
		return nil, fmt.Errorf("failed to get configs: %w", err)
	}

	log.Println("checking configs for availability")
	workingConfigs, err := filterWorkingConfigs(configs)
	if err != nil {
		return nil, fmt.Errorf("failed to filter working configs: %w", err)
	}

	log.Println("formatting configs")
	formattedConfigs, configsByCountry, err := formatConfigs(workingConfigs, locator)
	if err != nil {
		return nil, fmt.Errorf("failed to format configs: %w", err)
	}

	log.Println("updating cache and file")
	if err := updateCacheAndFile(formattedConfigs, configsCache, configsPath); err != nil {
		return nil, fmt.Errorf("failed to update cache and file: %w", err)
	}

	result := &UpdateResult{
		AmountConfigs:    len(formattedConfigs),
		Copies:           copies,
		NotWorking:       len(configs) - len(workingConfigs),
		ConfigsByCountry: configsByCountry,
	}

	return result, nil
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

// getConfigs fetching and returning configs from set sources, filtering copies
func getConfigs(ctx context.Context, sources []string) ([]string, int, error) {
	unique := make(map[string]struct{})
	uniqueConfigs := make([]string, 0, 4000)
	client := &http.Client{Timeout: sourceTimeout}

	var copies int
	var allErrors error
	var successCount int

	for _, source := range sources {
		configs, err := fetchConfigs(ctx, client, source)
		if err != nil {
			allErrors = errors.Join(allErrors, fmt.Errorf("failed to fetch from %s: %w", source, err))
			continue
		}

		successCount++

		for _, config := range configs {
			is, err := isUnique(config, unique)
			if err != nil {
				return nil, 0, fmt.Errorf("failed to check uniqueness for %s: %w", config, err)
			}

			if !is {
				copies++
				continue
			}

			uniqueConfigs = append(uniqueConfigs, config)
		}
	}

	if successCount == 0 && allErrors != nil {
		return nil, 0, fmt.Errorf("all sources failed to respond:\n%w", allErrors)
	}

	if allErrors != nil {
		log.Printf("warning: some sources failed to fetch: %v\n", allErrors)
	}

	return uniqueConfigs, copies, nil
}

// fetchConfigs downloads configs from source
func fetchConfigs(ctx context.Context, client *http.Client, source string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching source %s: %w", source, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, source)
	}

	var results []string
	scan := bufio.NewScanner(resp.Body)
	for scan.Scan() {
		results = append(results, strings.TrimSpace(scan.Text()))
	}

	if err := scan.Err(); err != nil {
		return nil, fmt.Errorf("scanning response from %s: %w", source, err)
	}

	return results, nil
}

// filterWorkingConfigs returns only working configs
func filterWorkingConfigs(uniqueConfigs []string) ([]string, error) {
	workingConfigs := make([]string, 0, len(uniqueConfigs))
	workersCh := make(chan struct{}, maxWorkers)

	var mu sync.Mutex
	var wg sync.WaitGroup
	var successCount int
	var allErrors error

	for _, config := range uniqueConfigs {
		wg.Add(1)

		go func() {
			defer wg.Done()

			workersCh <- struct{}{}
			defer func() {
				<-workersCh
			}()

			parsedConfig, err := url.Parse(config)
			if err != nil {
				allErrors = errors.Join(allErrors, fmt.Errorf("failed to parse config url %s: %w", config, err))
				return
			}

			successCount++

			if isWorking(parsedConfig.Host, pingTimeout) {
				mu.Lock()
				defer mu.Unlock()
				workingConfigs = append(workingConfigs, config)
			}
		}()
	}

	wg.Wait()

	if allErrors != nil && successCount < len(uniqueConfigs)/100*10 {
		return nil, fmt.Errorf("too many errors while checking configs for availability: %w", allErrors)
	}

	if allErrors != nil {
		log.Printf("warning: some errors while checking configs for availability: %v\n", allErrors)
	}

	return workingConfigs, nil
}

func formatConfigs(workingConfigs []string, locator *geo_ip.Locator) ([]string, map[string]int, error) {
	var mu sync.Mutex
	var wg sync.WaitGroup
	var successCount int
	var allErrors error

	workersCh := make(chan struct{}, maxWorkers)
	formattedConfigs := make([]string, 0, len(workingConfigs))
	configsByCountry := make(map[string]int)

	for i, config := range workingConfigs {
		wg.Add(1)

		go func() {
			defer wg.Done()
			workersCh <- struct{}{}
			defer func() {
				<-workersCh
			}()

			parsedConfig, err := url.Parse(config)
			if err != nil {
				allErrors = errors.Join(allErrors, fmt.Errorf("failed to parse config url %s: %w", config, err))
				return
			}

			successCount++

			name, flag := locator.GetCountryNameAndFlag(parsedConfig.Hostname())
			formatName(parsedConfig, name, flag, i)
			mu.Lock()
			defer mu.Unlock()

			configsByCountry[name]++
			formattedConfigs = append(formattedConfigs, parsedConfig.String())
		}()
	}

	wg.Wait()

	if allErrors != nil && successCount < len(workingConfigs)/100*10 {
		return nil, nil, fmt.Errorf("too many errors while formatting configs: %w", allErrors)
	}

	if allErrors != nil {
		log.Printf("warning: some errors while formatting configs: %v\n", allErrors)
	}

	return formattedConfigs, configsByCountry, nil
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
			return fmt.Errorf("failed to write temporary file: %w", err)
		}

		err = os.Rename(tmpPath, configsPath)
		if err != nil {
			log.Println("failed to replace configs file:", err)
			return fmt.Errorf("failed to replace configs file: %w", err)
		}

		return nil
	}

	return fmt.Errorf("no configs to update")
}

func isUnique(config string, unique map[string]struct{}) (bool, error) {
	parsedConfig, err := url.Parse(config)
	if err != nil {
		log.Printf("failed to parse dirty config. error: %v", err)
		return false, fmt.Errorf("failed to parse dirty config. error: %v", err)
	}

	parsedConfig.Fragment = ""
	configWithoutName := parsedConfig.String()
	if _, exists := unique[configWithoutName]; !exists && parsedConfig.Scheme == "vless" {
		unique[configWithoutName] = struct{}{}
		return true, nil
	}

	return false, nil
}
