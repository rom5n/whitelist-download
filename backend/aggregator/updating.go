package aggregator

import (
	"bufio"
	"context"
	"errors"
	"fmt"

	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/paths"
	box "github.com/sagernet/sing-box"
	C "github.com/sagernet/sing-box/constant"
	"github.com/sagernet/sing-box/include"
	"github.com/sagernet/sing-box/option"
	"github.com/sagernet/sing/common"
	"github.com/sagernet/sing/common/auth"
	"github.com/sagernet/sing/common/json/badoption"
	"go.uber.org/zap"

	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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

var updatesInProgress atomic.Int32

// UpdateInProgress reports whether configs are being updated right now (by the schedule or forced).
func UpdateInProgress() bool {
	return updatesInProgress.Load() > 0
}

func UpdateConfigs(ctx context.Context, configsCache *domain.SafeConfigsCache, sources []string, locator *geo_ip.Locator, level int) (*UpdateResult, error) {
	if len(sources) == 0 {
		return nil, errors.New("no sources provided")
	}

	updatesInProgress.Add(1)
	defer updatesInProgress.Add(-1)

	ctx, cancel := context.WithTimeout(ctx, updateTimeout)
	defer cancel()

	logging.Log.Debug("getting configs")
	configs, copies, err := getConfigs(ctx, sources)
	if err != nil {
		return nil, fmt.Errorf("failed to get configs: %w", err)
	}

	logging.Log.Debug("checking configs for availability")
	workingConfigs, err := filterWorkingConfigs(ctx, configs, level)
	if err != nil {
		return nil, fmt.Errorf("failed to filter working configs: %w", err)
	}

	logging.Log.Debug("formatting configs")
	formattedConfigs, configsByCountry, err := formatConfigs(ctx, workingConfigs, locator)
	if err != nil {
		return nil, fmt.Errorf("failed to format configs: %w", err)
	}

	logging.Log.Debug("sorting configs")
	sortedConfigs := SortConfigs(formattedConfigs)

	logging.Log.Debug("updating cache and file")
	if err = updateCacheAndFile(sortedConfigs, configsCache); err != nil {
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

// singBoxChecker checks configs through one sing-box instance: every config is an outbound, and a
// single local SOCKS inbound routes each connection to its outbound by the SOCKS username.
// Starting an instance costs ~0.2s that Windows serializes, so an instance per config made a
// level 2 update of ~1500 configs run past updateTimeout.
type singBoxChecker struct {
	instance *box.Box
	port     int
	users    map[string]string // config link -> SOCKS username
}

func newSingBoxChecker(ctx context.Context, configs []string) (*singBoxChecker, error) {
	port, err := freeLocalPort()
	if err != nil {
		return nil, fmt.Errorf("finding a free port: %w", err)
	}

	checker := &singBoxChecker{port: port, users: make(map[string]string, len(configs))}
	socks := &option.SocksInboundOptions{
		ListenOptions: option.ListenOptions{
			Listen:     common.Ptr(badoption.Addr(netip.AddrFrom4([4]byte{127, 0, 0, 1}))),
			ListenPort: uint16(port),
		},
	}
	opts := option.Options{
		Log:      &option.LogOptions{Disabled: true},
		Inbounds: []option.Inbound{{Type: "socks", Tag: "in-socks", Options: socks}},
		// Dial through the physical interface: with another VPN client's TUN up (Happ, v2rayN,
		// Hiddify...) the check would otherwise test the path through that VPN, not this network.
		Route: &option.RouteOptions{AutoDetectInterface: true},
	}

	for _, config := range configs {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if _, ok := checker.users[config]; ok {
			continue
		}

		tag := "proxy-" + strconv.Itoa(len(opts.Outbounds))
		outbound, err := buildVLESSOutbound(config, tag)
		if err != nil {
			logging.Log.Debug("sing-box parse error", zap.Error(err))
			continue
		}
		// One broken config must not fail the shared instance, so each one is validated on its
		// own first (box.New without Start is cheap).
		if err = validateOutbound(outbound); err != nil {
			logging.Log.Debug("sing-box core instance error", zap.Error(err))
			continue
		}

		user := "c" + strconv.Itoa(len(opts.Outbounds))
		checker.users[config] = user
		socks.Users = append(socks.Users, auth.User{Username: user, Password: user})
		opts.Outbounds = append(opts.Outbounds, outbound)
		opts.Route.Rules = append(opts.Route.Rules, option.Rule{
			Type: C.RuleTypeDefault,
			DefaultOptions: option.DefaultRule{
				RawDefaultRule: option.RawDefaultRule{AuthUser: []string{user}},
				RuleAction: option.RuleAction{
					Action:       C.RuleActionTypeRoute,
					RouteOptions: option.RouteActionOptions{Outbound: tag},
				},
			},
		})
	}

	if len(opts.Outbounds) == 0 {
		return checker, nil
	}

	// A connection that matched no user must not fall through to the first outbound.
	opts.Route.Rules = append(opts.Route.Rules, option.Rule{
		Type: C.RuleTypeDefault,
		DefaultOptions: option.DefaultRule{
			RawDefaultRule: option.RawDefaultRule{Inbound: []string{"in-socks"}},
			RuleAction:     option.RuleAction{Action: C.RuleActionTypeReject},
		},
	})

	instance, err := box.New(box.Options{Context: include.Context(context.Background()), Options: opts})
	if err != nil {
		return nil, fmt.Errorf("creating sing-box instance: %w", err)
	}
	if err = instance.Start(); err != nil {
		if closeErr := instance.Close(); closeErr != nil {
			logging.Log.Warn("failed to close sing-box instance", zap.Error(closeErr))
		}
		return nil, fmt.Errorf("starting sing-box instance: %w", err)
	}
	checker.instance = instance

	return checker, nil
}

// check reports whether a request through the config's outbound gets a response.
func (c *singBoxChecker) check(ctx context.Context, config string) bool {
	user, ok := c.users[config]
	if !ok || c.instance == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(ctx, urlTimeout)
	defer cancel()

	proxyURL := &url.URL{
		Scheme: "socks5",
		User:   url.UserPassword(user, user),
		Host:   net.JoinHostPort("127.0.0.1", strconv.Itoa(c.port)),
	}
	client := &http.Client{
		Timeout: urlTimeout,
		Transport: &http.Transport{
			Proxy:             http.ProxyURL(proxyURL),
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

func (c *singBoxChecker) Close() {
	if c.instance == nil {
		return
	}
	if err := c.instance.Close(); err != nil {
		logging.Log.Warn("failed to close sing-box instance", zap.Error(err))
	}
}

func validateOutbound(outbound option.Outbound) error {
	instance, err := box.New(box.Options{
		Context: include.Context(context.Background()),
		Options: option.Options{
			Log:       &option.LogOptions{Disabled: true},
			Outbounds: []option.Outbound{outbound},
		},
	})
	if err != nil {
		return err
	}
	if err = instance.Close(); err != nil {
		return fmt.Errorf("closing validation instance: %w", err)
	}
	return nil
}

func freeLocalPort() (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if err = listener.Close(); err != nil {
		return 0, err
	}
	return port, nil
}

func buildVLESSOutbound(link string, tag string) (option.Outbound, error) {
	u, err := url.Parse(link)
	if err != nil || u.Scheme != "vless" {
		return option.Outbound{}, errors.New("invalid or unsupported link format (only vless is supported)")
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

	if security == "reality" || security == "tls" {
		vless.TLS = &option.OutboundTLSOptions{
			Enabled:    true,
			ServerName: q.Get("sni"),
			UTLS: &option.OutboundUTLSOptions{
				Enabled:     true,
				Fingerprint: uTLSFingerprint(q.Get("fp")),
			},
		}
		if security == "reality" {
			vless.TLS.Reality = &option.OutboundRealityOptions{
				Enabled:   true,
				PublicKey: q.Get("pbk"),
				ShortID:   q.Get("sid"),
			}
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

	return option.Outbound{Type: "vless", Tag: tag, Options: &vless}, nil
}

// singBoxFingerprints are the uTLS fingerprints sing-box accepts (common/tls/utls_client.go).
var singBoxFingerprints = map[string]struct{}{
	"chrome": {}, "chrome_psk": {}, "chrome_psk_shuffle": {}, "chrome_padding_psk_shuffle": {},
	"chrome_pq": {}, "chrome_pq_psk": {}, "firefox": {}, "edge": {}, "safari": {}, "360": {},
	"qq": {}, "ios": {}, "android": {}, "random": {}, "randomized": {},
}

// uTLSFingerprint maps the link's "fp" to a fingerprint sing-box knows. Links are written for
// other clients (Xray accepts "unsafe", "randomizednoalpn", ...), and sing-box refuses to start
// on an unknown one, which would mark a working config as dead; those fall back to chrome.
func uTLSFingerprint(fp string) string {
	fp = strings.ToLower(strings.TrimSpace(fp))
	if _, ok := singBoxFingerprints[fp]; ok {
		return fp
	}
	return "chrome"
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
func filterWorkingConfigs(ctx context.Context, uniqueConfigs []string, level int) ([]string, error) {
	// Level 1: TCP dial (fast). Level 2: a real request through sing-box (slower, much more accurate).
	check := func(ctx context.Context, config string) (bool, error) {
		parsedConfig, err := url.Parse(config)
		if err != nil {
			return false, fmt.Errorf("failed to parse config url %s: %w", config, err)
		}
		return pingCheck(parsedConfig.Host, pingTimeout), nil
	}
	if level >= 2 {
		checker, err := newSingBoxChecker(ctx, uniqueConfigs)
		if err != nil {
			return nil, fmt.Errorf("failed to start sing-box checker: %w", err)
		}
		defer checker.Close()
		check = func(ctx context.Context, config string) (bool, error) {
			return checker.check(ctx, config), nil
		}
	}

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

			if ctx.Err() != nil {
				return
			}

			workersCh <- struct{}{}
			defer func() {
				<-workersCh
			}()

			working, err := check(ctx, config)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				allErrors = errors.Join(allErrors, fmt.Errorf("failed to check working config: %w", err))
			}
			if working {
				successCount++
				workingConfigs = append(workingConfigs, config)
			}
		}()
	}

	wg.Wait()

	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("checking interrupted: %w", err)
	}

	if allErrors != nil && successCount < len(uniqueConfigs)/100*10 {
		return nil, fmt.Errorf("too many errors while checking configs for availability: %w", allErrors)
	}

	if allErrors != nil {
		logging.Log.Warn("some errors while checking configs for availability", zap.Error(allErrors))
	}

	return workingConfigs, nil
}

func formatConfigs(ctx context.Context, workingConfigs []string, locator *geo_ip.Locator) ([]string, map[string]int, error) {
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

			if ctx.Err() != nil {
				return
			}

			workersCh <- struct{}{}
			defer func() {
				<-workersCh
			}()

			parsedConfig, err := url.Parse(config)
			if err != nil {
				mu.Lock()
				allErrors = errors.Join(allErrors, fmt.Errorf("failed to parse config url %s: %w", config, err))
				mu.Unlock()
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

	if err := ctx.Err(); err != nil {
		return nil, nil, fmt.Errorf("formatting interrupted: %w", err)
	}

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
			logging.Log.Warn("failed to parse config url while sorting", zap.String("url", config), zap.Error(err))
			continue
		}

		fragment := urlParts.Fragment
		firstSpace := strings.Index(fragment, " ")
		dashIndex := strings.Index(fragment, " — ")

		if firstSpace != -1 && dashIndex != -1 && dashIndex > firstSpace {
			country := fragment[firstSpace+1 : dashIndex]
			sortedConfigs[country] = append(sortedConfigs[country], config)
		} else {
			// Fallback in case of unexpected format
			parts := strings.Split(fragment, " ")
			if len(parts) > 1 {
				country := parts[1]
				sortedConfigs[country] = append(sortedConfigs[country], config)
			}
		}
	}

	return sortedConfigs
}

func updateCacheAndFile(sortedConfigs map[string][]string, configsCache *domain.SafeConfigsCache) error {
	configsPath, err := paths.ConfigsFile()
	if err != nil {
		logging.Log.Warn("failed to resolve configs path", zap.Error(err))
	}

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
