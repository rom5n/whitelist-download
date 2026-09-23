package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"github.com/adrg/xdg"
	"github.com/goccy/go-json"
)

type Field string

const (
	AppName           Field = "AppName"
	SubscriptionTitle Field = "SubscriptionTitle"
	DescriptionText   Field = "DescriptionText"
	Port              Field = "Port"
	ConfigsPath       Field = "ConfigsPath"
	SubscriptionPath  Field = "SubscriptionPath"
	UpdateInterval    Field = "UpdateInterval"
	Sources           Field = "Sources"
	ForcedIP          Field = "ForcedIP"
	WorkingCheckLevel Field = "WorkingCheckLevel"
	AutoUpdateMajor   Field = "AutoUpdateMajor"
	AutoUpdatePatch   Field = "AutoUpdatePatch"
	AutoBrowserOpen   Field = "AutoBrowserOpen"
)

type Config struct {
	sync.RWMutex      `json:"-"`
	AppName           string   `json:"app_name"`                 // Local system app name
	SubscriptionTitle string   `json:"subscription_title"`       // Subscription title in your client app
	DescriptionText   string   `json:"description_text"`         // Description in your client app
	Port              string   `json:"port" jsonDefault:"55000"` // App's port in your system
	ConfigsPath       string   `json:"configs_path"`             // Path for configs. For example: configs.txt
	SubscriptionPath  string   `json:"subscription_path"`        // Sub-path for subscription. For example: /sub - will be available in localhost:port/sub
	UpdateInterval    int      `json:"update_interval_minutes"`  // Interval in minutes for configs auto update
	Sources           []string `json:"sources"`                  // Configs sources
	ForcedIP          string   `json:"forced_ip"`                // Forced IP if your system identified invalid ip address (often happens on VPS servers)
	WorkingCheckLevel int      `json:"working_check_level"`      // 1 or 2. 1 - ping test, 2 - sing box core test
	AutoUpdateMajor   bool     `json:"auto_update_major"`        // Auto download major updates
	AutoUpdatePatch   bool     `json:"auto_update_patch"`        // Auto download bug fixes & improvements
	AutoBrowserOpen   bool     `json:"auto_browser_open"`        // Automatically open default browser on start
}

// newDefaultConfig Returns default app config
func newDefaultConfig() *Config {
	return &Config{
		AppName:           "WhitelistsDownload",
		SubscriptionTitle: "🌊 OpenSource VPN",
		DescriptionText:   "⚡ Subscriptions from open sources",
		Port:              "55000",
		ConfigsPath:       "configs.txt",
		SubscriptionPath:  "/sub",
		UpdateInterval:    60,
		ForcedIP:          "",
		WorkingCheckLevel: 1,
		AutoUpdateMajor:   false,
		AutoUpdatePatch:   true,
		AutoBrowserOpen:   true,
		Sources: []string{
			"https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt",
			"https://raw.githubusercontent.com/zieng2/wl/main/vless_universal.txt",
			"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile.txt",
			"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile-2.txt",
			"https://raw.githubusercontent.com/whoahaow/rjsxrd/refs/heads/main/githubmirror/bypass/bypass-all.txt",
			"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-CIDR-RU-all.txt",
		},
	}
}

func Load() *Config {
	configPath, err := xdg.ConfigFile(filepath.Join("whitelist-download", "config.json"))
	if err != nil {
		logging.Log.Error("failed to resolve config path", zap.Error(err))
		os.Exit(1)
	}

	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		oldConfigPath := filepath.Join(exeDir, "config.json")
		if _, err := os.Stat(oldConfigPath); err == nil {
			if _, err := os.Stat(configPath); os.IsNotExist(err) {
				os.Rename(oldConfigPath, configPath)
			}
		}
	}

	fileData, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultConfig(configPath)
		}
		logging.Log.Error("failed to read file config.json", zap.Error(err))
		os.Exit(1)
	}

	currentConfig := newDefaultConfig()
	if err = json.Unmarshal(fileData, currentConfig); err != nil {
		logging.Log.Error("syntax error in config.json. fix the file or delete it to use default app config", zap.Error(err))
		os.Exit(1)
	}

	return currentConfig
}

func DefaultConfig(configPath string) *Config {
	logging.Log.Warn("file config.json not found. using defaults.")

	currentConfig := newDefaultConfig()
	defaultJSON, _ := json.MarshalIndent(currentConfig, "", "  ")

	if err := os.WriteFile(configPath, defaultJSON, 0644); err != nil {
		logging.Log.Error("failed to create file config.json", zap.Error(err))
		os.Exit(1)
	}

	return currentConfig
}

func (config *Config) Set(new *Config) error {
	config.Lock()
	defer config.Unlock()

	config.AppName = new.AppName
	config.SubscriptionTitle = new.SubscriptionTitle
	config.DescriptionText = new.DescriptionText
	config.Port = new.Port
	config.ConfigsPath = new.ConfigsPath
	config.Sources = new.Sources
	config.SubscriptionPath = new.SubscriptionPath
	config.UpdateInterval = new.UpdateInterval
	config.ForcedIP = new.ForcedIP
	config.WorkingCheckLevel = new.WorkingCheckLevel
	config.AutoUpdateMajor = new.AutoUpdateMajor
	config.AutoUpdatePatch = new.AutoUpdatePatch
	config.AutoBrowserOpen = new.AutoBrowserOpen

	if err := config.Save(); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	return nil
}

func (config *Config) Save() error {
	finalPath, err := xdg.ConfigFile(filepath.Join("whitelist-download", "config.json"))
	if err != nil {
		return fmt.Errorf("failed to resolve config path: %w", err)
	}

	tmpPath := finalPath + ".tmp"

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal json: %w", err)
	}

	err = os.WriteFile(tmpPath, data, 0644)
	if err != nil {
		return fmt.Errorf("fail while writing to tmp file: %w", err)
	}

	err = os.Rename(tmpPath, finalPath)
	if err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to rename tmp file: %w", err)
	}

	return nil
}

func (config *Config) RetrieveSafe(fields ...Field) *Config {
	config.RLock()
	defer config.RUnlock()
	var cfg Config
	for _, field := range fields {
		switch field {
		case AppName:
			cfg.AppName = config.AppName
		case SubscriptionTitle:
			cfg.SubscriptionTitle = config.SubscriptionTitle
		case DescriptionText:
			cfg.DescriptionText = config.DescriptionText
		case Port:
			cfg.Port = config.Port
		case ConfigsPath:
			cfg.ConfigsPath = config.ConfigsPath
		case SubscriptionPath:
			cfg.SubscriptionPath = config.SubscriptionPath
		case UpdateInterval:
			cfg.UpdateInterval = config.UpdateInterval
		case ForcedIP:
			cfg.ForcedIP = config.ForcedIP
		case Sources:
			sources := make([]string, len(config.Sources))
			copy(sources, config.Sources)
			cfg.Sources = sources
		case WorkingCheckLevel:
			cfg.WorkingCheckLevel = config.WorkingCheckLevel
		case AutoUpdateMajor:
			cfg.AutoUpdateMajor = config.AutoUpdateMajor
		case AutoUpdatePatch:
			cfg.AutoUpdatePatch = config.AutoUpdatePatch
		case AutoBrowserOpen:
			cfg.AutoBrowserOpen = config.AutoBrowserOpen
		}
	}

	return &cfg
}
