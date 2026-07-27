package http

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"io/fs"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

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

func Start(ctx context.Context, cancel context.CancelFunc, wg *sync.WaitGroup, cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator, updaterState *domain.SafeUpdaterState) {
	defer wg.Done()
	serverCfg := getServerConfig(cfg)
	
	mux := http.NewServeMux()
	connectRoutes(ctx, cancel, mux, cfg, serverCfg, statistics, locator, configsCache, updaterState)
	startupLogs(serverCfg)

	srv := &http.Server{
		Addr:    "0.0.0.0:" + serverCfg.Port,
		Handler: mux,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logging.Log.Fatal("error while starting subscription server", zap.Error(err))
		}
	}()

	<-ctx.Done()
	logging.Log.Info("shutting down http server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logging.Log.Error("server shutdown error", zap.Error(err))
	}
	logging.Log.Info("http server gracefully stopped")
}

func startupLogs(cfg *serverConfig) {
	logging.Log.Info("⚡ Server started", zap.String("port", cfg.Port))
	logging.Log.Info("✨ Check subscriptions", zap.String("link", cfg.SubscriptionLink))
	logging.Log.Info("🌊 Check web", zap.String("link", cfg.WebLink))
}

func getServerConfig(cfg *config.Config) *serverConfig {
	cfgSafe := cfg.RetrieveSafe(config.SubscriptionPath, config.Port, config.ForcedIP)
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

func connectRoutes(ctx context.Context, cancel context.CancelFunc, mux *http.ServeMux, cfg *config.Config, serverCfg *serverConfig, statistics *domain.Statistics, locator *geo_ip.Locator, configsCache *domain.SafeConfigsCache, updaterState *domain.SafeUpdaterState) {
	subPath := serverCfg.SubscriptionPath
	ip := serverCfg.IP
	port := serverCfg.Port

	// Subscription paths
	mux.HandleFunc(subPath, subscriptionHandler(cfg, configsCache))
	mux.HandleFunc(subPath+"/", subscriptionHandler(cfg, configsCache))

	// API paths
	mux.Handle("/api/subscription-link", http.HandlerFunc(getSubscriptionLink(cfg, ip, port)))
	mux.Handle("/api/statistics", http.HandlerFunc(getStatistics(statistics)))
	mux.Handle("/api/restart", http.HandlerFunc(restart(cancel)))
	mux.Handle("/api/update-configs", http.HandlerFunc(updateConfigs(ctx, cfg, configsCache, statistics, locator)))
	mux.Handle("/api/get-config", http.HandlerFunc(getConfig(cfg)))
	mux.Handle("/api/set-config", http.HandlerFunc(setConfig(ctx, cfg, updaterState, statistics, cancel)))
	mux.Handle("/api/logs", http.HandlerFunc(getLogs(logging.LogPath)))
	mux.Handle("/api/configs", http.HandlerFunc(getConfigs(cfg, configsCache)))
	mux.Handle("/api/updater/status", http.HandlerFunc(getUpdaterStatus(updaterState)))
	mux.Handle("/api/updater/download", http.HandlerFunc(downloadUpdate(updaterState, cancel)))

	distFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		logging.Log.Fatal("failed to initialize embedded static files", zap.Error(err))
	}
	fileServer := http.FileServer(http.FS(distFS))

	// web frontend path
	mux.HandleFunc("/", web(fileServer, distFS))
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
