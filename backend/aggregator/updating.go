package aggregator

import (
	"bufio"
	"context"
	"errors"
	"fmt"

	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/logging"
	box "github.com/sagernet/sing-box"
	"github.com/sagernet/sing-box/include"
	"github.com/sagernet/sing-box/option"
	"go.uber.org/zap"

	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	pingTimeout   = 2 * time.Second
	urlTimeout    = 7 * time.Second
	sourceTimeout = 5 * time.Second
	updateTimeout = 5 * time.Minute
	maxWorkers    = 150
)

type UpdateResult struct {
	AmountConfigs    int
	Copies           int
	NotWorking       int
	ConfigsByCountry map[string]int
}

var portPool chan int

func UpdateConfigs(configsPath string, configsCache *domain.SafeConfigsCache, sources []string, locator *geo_ip.Locator, level int) (*UpdateResult, error) {
	if len(sources) == 0 {
		return nil, errors.New("no sources provided")
	}

	ctx, cancel := context.WithTimeout(context.Background(), updateTimeout)
	defer cancel()

	logging.Log.Info("getting configs")
	configs, copies, err := getConfigs(ctx, sources)
	if err != nil {
		return nil, fmt.Errorf("failed to get configs: %w", err)
	}

	logging.Log.Info("checking configs for availability")
	workingConfigs, err := filterWorkingConfigs(configs, level)
	if err != nil {
		return nil, fmt.Errorf("failed to filter working configs: %w", err)
	}

	logging.Log.Info("formatting configs")
	formattedConfigs, configsByCountry, err := formatConfigs(workingConfigs, locator)
	if err != nil {
		return nil, fmt.Errorf("failed to format configs: %w", err)
	}

	logging.Log.Info("sorting configs")
	sortedConfigs := SortConfigs(formattedConfigs)

	logging.Log.Info("updating cache and file")
	if err = updateCacheAndFile(sortedConfigs, configsCache, configsPath); err != nil {
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

// isWorking Has 2 levels of verification: 1 - ping test (fast), 2 - sing box check (50x slower, about 500ms, but a much better)
func isWorking(config string, level int) (bool, error) {
	if level < 2 {
		parsedConfig, err := url.Parse(config)
		if err != nil {
			return false, fmt.Errorf("failed to parse config url %s: %w", config, err)
		}
		return pingCheck(parsedConfig.Host, pingTimeout), nil
	}

	return singBoxCheck(config, urlTimeout), nil
}

func pingCheck(link string, timeout time.Duration) bool {
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

var singBoxMutex sync.Mutex

func init() {
	portPool = make(chan int, maxWorkers)
	for i := 0; i < maxWorkers; i++ {
		portPool <- 20000 + i
	}
}

func singBoxCheck(config string, timeout time.Duration) bool {
	localPort := <-portPool
	defer func() { portPool <- localPort }()

	opts, err := buildSingBoxOptions(config, localPort)
	if err != nil {
		logging.Log.Error("sing-box parse error", zap.Error(err))
		return false
	}

	singBoxMutex.Lock()
	ctx := include.Context(context.Background())
	instance, err := box.New(box.Options{
		Context: ctx,
		Options: opts,
	})
	singBoxMutex.Unlock()
	
	if err != nil {
		logging.Log.Error("sing-box core instance error", zap.Error(err))
		return false
	}

	if err := instance.Start(); err != nil {
		logging.Log.Error("sing-box start error", zap.Error(err))
		return false
	}
	defer instance.Close()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	proxyUrl, _ := url.Parse(fmt.Sprintf("socks5://127.0.0.1:%d", localPort))
	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy:             http.ProxyURL(proxyUrl),
			DisableKeepAlives: true,
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://cp.cloudflare.com/generate_204", nil)
	if err != nil {
		return false
	}

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusOK
}

func buildSingBoxOptions(link string, localPort int) (option.Options, error) {
	u, err := url.Parse(link)
	if err != nil || u.Scheme != "vless" {
		return option.Options{}, errors.New("invalid or unsupported link format (only vless is supported)")
	}

	port, err := strconv.Atoi(u.Port())
	if err != nil {
		port = 443
	}

	q := u.Query()
	netType := q.Get("type")
	security := q.Get("security")

	vless := option.VLESSOutboundOptions{
		ServerOptions: option.ServerOptions{
			Server:     u.Hostname(),
			ServerPort: uint16(port),
		},
		UUID: u.User.Username(),
		Flow: q.Get("flow"),
	}

	if security == "reality" {
		vless.TLS = &option.OutboundTLSOptions{
			Enabled:    true,
			ServerName: q.Get("sni"),
			Reality: &option.OutboundRealityOptions{
				Enabled:   true,
				PublicKey: q.Get("pbk"),
				ShortID:   q.Get("sid"),
			},
			UTLS: &option.OutboundUTLSOptions{
				Enabled:     true,
				Fingerprint: q.Get("fp"),
			},
		}
	} else if security == "tls" {
		vless.TLS = &option.OutboundTLSOptions{
			Enabled:    true,
			ServerName: q.Get("sni"),
			UTLS: &option.OutboundUTLSOptions{
				Enabled:     true,
				Fingerprint: q.Get("fp"),
			},
		}
	}

	if netType == "ws" {
		vless.Transport = &option.V2RayTransportOptions{
			Type: "ws",
			WebsocketOptions: option.V2RayWebsocketOptions{
				Path: q.Get("path"),
			},
		}
	} else if netType == "grpc" {
		vless.Transport = &option.V2RayTransportOptions{
			Type: "grpc",
			GRPCOptions: option.V2RayGRPCOptions{
				ServiceName: q.Get("serviceName"),
			},
		}
	}

	return option.Options{
		Inbounds: []option.Inbound{
			{
				Type: "socks",
				Tag:  "in-socks",
				Options: &option.SocksInboundOptions{
					ListenOptions: option.ListenOptions{
						ListenPort: uint16(localPort),
					},
				},
			},
		},
		Outbounds: []option.Outbound{
			{
				Type:                 "vless",
				Tag:                  "proxy",
				Options:              &vless,
			},
		},
	}, nil
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
		logging.Log.Warn("some sources failed to fetch", zap.Error(allErrors))
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
		text := scan.Text()
		if _, err = url.Parse(text); err != nil {
			continue
		}
		results = append(results, strings.TrimSpace(text))
	}

	if err = scan.Err(); err != nil {
		return nil, fmt.Errorf("scanning response from %s: %w", source, err)
	}

	return results, nil
}

// filterWorkingConfigs returns only working configs
func filterWorkingConfigs(uniqueConfigs []string, level int) ([]string, error) {
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

			working, err := isWorking(config, level)
			if err != nil {
				allErrors = errors.Join(allErrors, fmt.Errorf("failed to check working config: %w", err))
			}
			if working {
				mu.Lock()
				defer mu.Unlock()
				successCount++
				workingConfigs = append(workingConfigs, config)
			}
		}()
	}

	wg.Wait()

	if allErrors != nil && successCount < len(uniqueConfigs)/100*10 {
		return nil, fmt.Errorf("too many errors while checking configs for availability: %w", allErrors)
	}

	if allErrors != nil {
		logging.Log.Warn("some errors while checking configs for availability", zap.Error(allErrors))
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

			name, flag := locator.GetCountryNameAndFlag(parsedConfig.Hostname())
			formatName(parsedConfig, name, flag, i)
			mu.Lock()
			defer mu.Unlock()

			successCount++
			configsByCountry[name]++
			formattedConfigs = append(formattedConfigs, parsedConfig.String())
		}()
	}

	wg.Wait()

	if allErrors != nil && successCount < len(workingConfigs)/100*10 {
		return nil, nil, fmt.Errorf("too many errors while formatting configs: %w", allErrors)
	}

	if allErrors != nil {
		logging.Log.Warn("some errors while formatting configs", zap.Error(allErrors))
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

func SortConfigs(formattedConfigs []string) map[string][]string {
	sortedConfigs := make(map[string][]string)
	for _, config := range formattedConfigs {
		urlParts, err := url.Parse(config)
		if err != nil {
			logging.Log.Error("failed to parse config url while sorting", zap.String("url", config), zap.Error(err))
			continue
		}
		parts := strings.Split(urlParts.Fragment, " ")
		country := parts[1]
		sortedConfigs[country] = append(sortedConfigs[country], config)
	}

	return sortedConfigs
}

func updateCacheAndFile(sortedConfigs map[string][]string, configsCache *domain.SafeConfigsCache, configsPath string) error {
	if len(sortedConfigs) > 0 {
		configsCache.Set(sortedConfigs)

		var builder strings.Builder
		for _, configs := range sortedConfigs {
			for _, config := range configs {
				builder.WriteString(config)
				builder.WriteString("\n")
			}
		}

		data := []byte(builder.String())

		tmpPath := configsPath + ".tmp"

		err := os.WriteFile(tmpPath, data, 0666)
		if err != nil {
			return fmt.Errorf("failed to write temporary file: %w", err)
		}

		err = os.Rename(tmpPath, configsPath)
		if err != nil {
			return fmt.Errorf("failed to replace configs file: %w", err)
		}

		return nil
	}

	return fmt.Errorf("no configs to update")
}

func isUnique(config string, unique map[string]struct{}) (bool, error) {
	parsedConfig, err := url.Parse(config)
	if err != nil {
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
