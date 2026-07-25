package aggregator

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"github.com/goccy/go-json"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/xtls/xray-core/core"
	"github.com/xtls/xray-core/infra/conf/serial"
	"go.uber.org/zap"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	stdnet "net"

	xnet "github.com/xtls/xray-core/common/net"

	_ "github.com/xtls/xray-core/main/distro/all"
)

const (
	pingTimeout   = 2 * time.Second
	xrayTimeout   = 7 * time.Second
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
type xrayServerCtxKey struct{}

var (
	targetDest   xnet.Destination
	sharedClient *http.Client
)

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

// isWorking Has 2 levels of verification: 1 - ping test (fast), 2 - xray check (50x slower, about 500ms, but a much better)
func isWorking(config string, level int) (bool, error) {
	if level < 2 {
		parsedConfig, err := url.Parse(config)
		if err != nil {
			return false, fmt.Errorf("failed to parse config url %s: %w", config, err)
		}
		return pingCheck(parsedConfig.Host, pingTimeout), nil
	}

	return xrayCheck(config, xrayTimeout), nil
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

func init() {
	targetDest, _ = xnet.ParseDestination("tcp:cp.cloudflare.com:80")
	sharedClient = &http.Client{
		Transport: &http.Transport{
			DisableKeepAlives: true,
			DialContext: func(ctx context.Context, network, addr string) (stdnet.Conn, error) {
				srv := ctx.Value(xrayServerCtxKey{}).(*core.Instance)
				return core.Dial(ctx, srv, targetDest)
			},
		},
	}
}

func xrayCheck(config string, timeout time.Duration) bool {
	xrayConfig, err := parseToXrayConfig(config)
	if err != nil {
		logging.Log.Error("xray parse error", zap.Error(err))
		return false
	}

	server, err := core.New(xrayConfig)
	if err != nil {
		logging.Log.Error("xray core instance error", zap.Error(err))
		return false
	}

	if err := server.Start(); err != nil {
		logging.Log.Error("xray server start error", zap.Error(err))
		return false
	}
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ctxWithServer := context.WithValue(ctx, xrayServerCtxKey{}, server)

	req, err := http.NewRequestWithContext(ctxWithServer, http.MethodGet, "http://cp.cloudflare.com/generate_204", nil)
	if err != nil {
		return false
	}

	resp, err := sharedClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusOK
}

func parseToXrayConfig(input string) (*core.Config, error) {
	jsonConfig, err := convertVlessToXrayJSON(input)
	if err != nil {
		return nil, fmt.Errorf("failed to convert link to json: %w", err)
	}

	confConfig, err := serial.DecodeJSONConfig(strings.NewReader(jsonConfig))
	if err != nil {
		return nil, err
	}

	return confConfig.Build()
}

// convertVlessToXrayJSON динамически собирает JSON-конфиг Xray на основе параметров vless:// ссылки
func convertVlessToXrayJSON(link string) (string, error) {
	u, err := url.Parse(link)
	if err != nil || u.Scheme != "vless" {
		return "", errors.New("invalid or unsupported link format (only vless is supported in this parser)")
	}

	port, err := strconv.Atoi(u.Port())
	if err != nil {
		port = 443
	}

	q := u.Query()
	netType := q.Get("type")
	if netType == "" {
		netType = "tcp"
	}
	security := q.Get("security")
	if security == "" {
		security = "none"
	}

	streamSettings := map[string]any{
		"network":  netType,
		"security": security,
	}

	if security == "reality" {
		streamSettings["realitySettings"] = map[string]any{
			"serverName":  q.Get("sni"),
			"publicKey":   q.Get("pbk"),
			"fingerprint": q.Get("fp"),
			"shortId":     q.Get("sid"),
			"spiderX":     q.Get("spx"),
		}
	} else if security == "tls" {
		streamSettings["tlsSettings"] = map[string]any{
			"serverName":    q.Get("sni"),
			"fingerprint":   q.Get("fp"),
			"allowInsecure": false,
		}
	}

	if netType == "ws" {
		streamSettings["wsSettings"] = map[string]any{
			"path": q.Get("path"),
			"headers": map[string]any{
				"Host": q.Get("host"),
			},
		}
	} else if netType == "grpc" {
		streamSettings["grpcSettings"] = map[string]any{
			"serviceName": q.Get("serviceName"),
			"multiMode":   q.Get("mode") == "multi",
		}
	} else if netType == "tcp" && q.Get("headerType") == "http" {
		streamSettings["tcpSettings"] = map[string]any{
			"header": map[string]any{
				"type": "http",
				"request": map[string]any{
					"path": []string{q.Get("path")},
					"headers": map[string]any{
						"Host": []string{q.Get("host")},
					},
				},
			},
		}
	}

	config := map[string]any{
		"outbounds": []any{
			map[string]any{
				"protocol": "vless",
				"settings": map[string]any{
					"vnext": []any{
						map[string]any{
							"address": u.Hostname(),
							"port":    port,
							"users": []any{
								map[string]any{
									"id":         u.User.Username(),
									"encryption": "none",
									"flow":       q.Get("flow"),
								},
							},
						},
					},
				},
				"streamSettings": streamSettings,
			},
		},
	}

	b, err := json.Marshal(config)
	return string(b), err
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
		results = append(results, strings.TrimSpace(scan.Text()))
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
