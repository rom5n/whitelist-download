package http

import (
	"embed"
	"fmt"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"io/fs"
	"net"
	"net/http"
	"strings"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
)

//go:embed dist/*
var staticFiles embed.FS

type serverConfig struct {
	SubscriptionPath string
	Port             string
	IP               string
	SubscriptionLink string
	WebLink          string
}

func Start(cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator) {
	serverCfg := getServerConfig(cfg)
	connectRoutes(cfg, serverCfg, statistics, locator, configsCache)
	startupLogs(serverCfg)

	err := http.ListenAndServe("0.0.0.0:"+serverCfg.Port, nil)
	if err != nil {
		logging.Log.Fatal("error while starting subscription server", zap.Error(err))
	}
}

func startupLogs(cfg *serverConfig) {
	logging.Log.Info("⚡ Server started", zap.String("port", cfg.Port))
	logging.Log.Info("✨ Check subscriptions", zap.String("link", cfg.SubscriptionLink))
	logging.Log.Info("🌊 Check web", zap.String("link", cfg.WebLink))
}

func getServerConfig(cfg *config.Config) *serverConfig {
	cfgSafe := cfg.RetrieveSafe(config.ConfigsPath, config.Port, config.ForcedIP)
	subPath := cfgSafe.SubscriptionPath
	port := cfgSafe.Port
	forcedIP := cfgSafe.ForcedIP

	ip := getIP()
	if forcedIP != "" {
		ip = forcedIP
	}

	subLink := fmt.Sprintf("%v://%v:%v%v", "http", ip, port, subPath+"/15")
	webLink := fmt.Sprintf("%v://%v:%v/%v", "http", ip, port, "")

	return &serverConfig{
		SubscriptionPath: subPath,
		Port:             port,
		IP:               ip,
		SubscriptionLink: subLink,
		WebLink:          webLink,
	}
}

func connectRoutes(cfg *config.Config, serverCfg *serverConfig, statistics *domain.Statistics, locator *geo_ip.Locator, configsCache *domain.SafeConfigsCache) {
	subPath := serverCfg.SubscriptionPath
	ip := serverCfg.IP
	port := serverCfg.Port

	// Subscription paths
	http.HandleFunc(subPath, subscriptionHandler(cfg, configsCache))
	http.HandleFunc(subPath+"/", subscriptionHandler(cfg, configsCache))

	// API paths
	http.Handle("/api/subscription-link", http.HandlerFunc(getSubscriptionLink(cfg, ip, port)))
	http.Handle("/api/statistics", http.HandlerFunc(getStatistics(statistics)))
	http.Handle("/api/restart", http.HandlerFunc(restart()))
	http.Handle("/api/update-configs", http.HandlerFunc(updateConfigs(cfg, configsCache, statistics, locator)))
	http.Handle("/api/get-config", http.HandlerFunc(getConfig(cfg)))
	http.Handle("/api/set-config", http.HandlerFunc(setConfig(cfg)))
	http.Handle("/api/logs", http.HandlerFunc(getLogs(logging.LogPath)))

	distFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		logging.Log.Fatal("failed to initialize embedded static files", zap.Error(err))
	}
	fileServer := http.FileServer(http.FS(distFS))

	// web frontend path
	http.HandleFunc("/", web(fileServer, distFS))
}

func getIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}

	var fallbackIP string

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		if iface.Flags&net.FlagPointToPoint != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				ip := ipnet.IP.To4()
				if ip != nil {
					ipStr := ip.String()

					if strings.HasPrefix(ipStr, "198.18.") {
						continue
					}

					if strings.HasPrefix(ipStr, "192.168.") {
						return ipStr
					}

					if ip.IsPrivate() {
						fallbackIP = ipStr
					}
				}
			}
		}
	}

	if fallbackIP != "" {
		return fallbackIP
	}

	return "127.0.0.1"
}
