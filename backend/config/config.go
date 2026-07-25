package config

import (
	"fmt"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"sync"

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
}

// defaultCfg Default app config
var defaultCfg = Config{
	AppName:           "WhitelistsDownload",
	SubscriptionTitle: "🌊 OpenSource VPN",
	DescriptionText:   "⚡ Subscriptions from open sources",
	Port:              "55000",
	ConfigsPath:       "configs.txt",
	SubscriptionPath:  "/sub",
	UpdateInterval:    60,
	ForcedIP:          "",
	Sources: []string{
		"https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt",
		"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile.txt",
		"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile-2.txt",
		"https://raw.githubusercontent.com/whoahaow/rjsxrd/refs/heads/main/githubmirror/bypass/bypass-all.txt",
	},
}

func Load() *Config {
	exePath, err := os.Executable()
	if err != nil {
		logging.Log.Fatal("failed to get executable file path", zap.Error(err))
	}

	exeDir := filepath.Dir(exePath)
	configPath := filepath.Join(exeDir, "config.json")

	fileData, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultConfig(configPath)
		}
		logging.Log.Fatal("failed to read file config.json", zap.Error(err))
	}

	var currentConfig Config
	if err = json.Unmarshal(fileData, &currentConfig); err != nil {
		logging.Log.Fatal("syntax error in config.json. fix the file or delete it to use default app config", zap.Error(err))
	}

	return &currentConfig
}

func DefaultConfig(configPath string) *Config {
	logging.Log.Info("file config.json not found. using defaults.")

	defaultJSON, _ := json.MarshalIndent(&defaultCfg, "", "  ")

	if err := os.WriteFile(configPath, defaultJSON, 0644); err != nil {
		logging.Log.Fatal("failed to create file config.json", zap.Error(err))
	}

	return &defaultCfg
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

	if err := config.Save(); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	return nil
}

func (config *Config) Save() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get program's path: %w", err)
	}
	exeDir := filepath.Dir(exePath)

	finalPath := filepath.Join(exeDir, "config.json")
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
			copy(cfg.Sources, config.Sources)
		}
	}

	return &cfg
}
