package http

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/geo_ip"
	"github.com/rom5n/whitelist-download/backend/http/handler"
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

func Start(ctx context.Context, cancel context.CancelFunc, wg *sync.WaitGroup, cfg *config.Config, configsCache *domain.SafeConfigsCache, statistics *domain.Statistics, locator *geo_ip.Locator, updaterState *domain.SafeUpdaterState, scheduler *aggregator.Scheduler) {
	defer wg.Done()
	serverCfg := getServerConfig(cfg)

	mux := http.NewServeMux()
	connectRoutes(ctx, cancel, mux, cfg, serverCfg, statistics, locator, configsCache, updaterState, scheduler)
	startupLogs(serverCfg)

	srv := &http.Server{
		Addr:    "0.0.0.0:" + serverCfg.Port,
		Handler: mux,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logging.Log.Error("error while starting subscription server", zap.Error(err))
			os.Exit(1)
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

func connectRoutes(ctx context.Context, cancel context.CancelFunc, mux *http.ServeMux, cfg *config.Config, serverCfg *serverConfig, statistics *domain.Statistics, locator *geo_ip.Locator, configsCache *domain.SafeConfigsCache, updaterState *domain.SafeUpdaterState, scheduler *aggregator.Scheduler) {
	subPath := serverCfg.SubscriptionPath
	ip := serverCfg.IP
	port := serverCfg.Port

	// Subscription paths
	mux.HandleFunc(subPath, handler.Subscription(cfg, configsCache))
	mux.HandleFunc(subPath+"/", handler.Subscription(cfg, configsCache))

	// API paths
	mux.Handle("/api/subscription-link", http.HandlerFunc(handler.SubscriptionLink(cfg, ip, port)))
	mux.Handle("/api/statistics", http.HandlerFunc(handler.Statistics(statistics)))
	mux.Handle("/api/restart", http.HandlerFunc(handler.Restart(cancel)))
	mux.Handle("/api/update-configs", http.HandlerFunc(handler.UpdateConfigs(ctx, cfg, configsCache, statistics, locator, scheduler)))
	mux.Handle("/api/get-config", http.HandlerFunc(handler.Config(cfg)))
	mux.Handle("/api/restart-required", http.HandlerFunc(handler.RestartRequired(cfg)))
	mux.Handle("/api/set-config", http.HandlerFunc(handler.SetConfig(ctx, cfg, updaterState, statistics, cancel, scheduler)))
	mux.Handle("/api/logs", http.HandlerFunc(handler.Logs(logging.LogPath)))
	mux.Handle("/api/configs", http.HandlerFunc(handler.Configs(cfg, configsCache)))
	mux.Handle("/api/updater/status", http.HandlerFunc(handler.UpdaterStatus(updaterState)))
	mux.Handle("/api/updater/download", http.HandlerFunc(handler.DownloadUpdate(updaterState, cancel)))
	mux.Handle("/api/polling", http.HandlerFunc(handler.PollingState(scheduler)))
	mux.Handle("/api/polling/pause", http.HandlerFunc(handler.PollingPause(scheduler)))
	mux.Handle("/api/polling/resume", http.HandlerFunc(handler.PollingResume(scheduler)))
	mux.Handle("/api/polling/check-level", http.HandlerFunc(handler.PollingCheckLevel(scheduler)))

	distFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		logging.Log.Error("failed to initialize embedded static files", zap.Error(err))
		os.Exit(1)
	}
	fileServer := http.FileServer(http.FS(distFS))

	// web frontend path
	mux.HandleFunc("/", handler.Web(fileServer, distFS))
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
