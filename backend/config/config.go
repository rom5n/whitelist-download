package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
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
	SubscriptionPath  Field = "SubscriptionPath"
	UpdateInterval    Field = "UpdateInterval"
	Sources           Field = "Sources"
	ForcedIP          Field = "ForcedIP"
	WorkingCheckLevel Field = "WorkingCheckLevel"
	AutoUpdateMajor   Field = "AutoUpdateMajor"
	AutoUpdatePatch   Field = "AutoUpdatePatch"
	AutoBrowserOpen   Field = "AutoBrowserOpen"
	AutoStart         Field = "AutoStart"
)

const (
	DefaultUpdateInterval = 15   // minutes
	MinUpdateInterval     = 5    // minutes
	MaxUpdateInterval     = 1440 // minutes (24 hours)
)

// ErrInvalidConfig is returned by Set when the new config fails validation
var ErrInvalidConfig = errors.New("invalid config")

// bootValues holds the values the running process was started with.
// Changing any of them only takes effect after a restart.
type bootValues struct {
	Port             string
	SubscriptionPath string
	AppName          string
}

type Config struct {
	sync.RWMutex      `json:"-"`
	AppName           string   `json:"app_name"`                 // Local system app name
	SubscriptionTitle string   `json:"subscription_title"`       // Subscription title in your client app
	DescriptionText   string   `json:"description_text"`         // Description in your client app
	Port              string   `json:"port" jsonDefault:"55000"` // App's port in your system
	SubscriptionPath  string   `json:"subscription_path"`        // Sub-path for subscription. For example: /sub - will be available in localhost:port/sub
	UpdateInterval    int      `json:"update_interval_minutes"`  // Interval in minutes for configs auto update
	Sources           []string `json:"sources"`                  // Configs sources
	ForcedIP          string   `json:"forced_ip"`                // Forced IP if your system identified invalid ip address (often happens on VPS servers)
	WorkingCheckLevel int      `json:"working_check_level"`      // 1 or 2. 1 - ping test, 2 - sing box core test
	AutoUpdateMajor   bool     `json:"auto_update_major"`        // Auto download major updates
	AutoUpdatePatch   bool     `json:"auto_update_patch"`        // Auto download bug fixes & improvements
	AutoBrowserOpen   bool     `json:"auto_browser_open"`        // Automatically open default browser on start
	AutoStart         bool     `json:"auto_start"`               // Launch the app on OS login. Managed from the tray menu

	boot bootValues
}

// newDefaultConfig Returns default app config
func newDefaultConfig() *Config {
	return &Config{
		AppName:           "WhitelistsDownload",
		SubscriptionTitle: "🌊 OpenSource VPN",
		DescriptionText:   "⚡ Subscriptions from open sources",
		Port:              "55000",
		SubscriptionPath:  "/sub",
		UpdateInterval:    DefaultUpdateInterval,
		ForcedIP:          "",
		WorkingCheckLevel: 1,
		AutoUpdateMajor:   false,
		AutoUpdatePatch:   true,
		AutoBrowserOpen:   true,
		AutoStart:         true,
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

	if clamped := clampUpdateInterval(currentConfig.UpdateInterval); clamped != currentConfig.UpdateInterval {
		logging.Log.Warn("update interval is out of range, clamped", zap.Int("from", currentConfig.UpdateInterval), zap.Int("to", clamped))
		currentConfig.UpdateInterval = clamped
	}

	if migrated, err := migrateLegacyConfigsPath(fileData); err != nil {
		logging.Log.Error("failed to migrate legacy configs_path setting", zap.Error(err))
	} else if migrated {
		if err := currentConfig.Save(); err != nil {
			logging.Log.Error("failed to save migrated config", zap.Error(err))
		}
	}

	currentConfig.captureBootValues()
	return currentConfig
}

func (config *Config) captureBootValues() {
	config.boot = bootValues{
		Port:             config.Port,
		SubscriptionPath: config.SubscriptionPath,
		AppName:          config.AppName,
	}
}

func clampUpdateInterval(minutes int) int {
	return max(MinUpdateInterval, min(MaxUpdateInterval, minutes))
}

// Validate checks values that can be changed from the web dashboard
func (config *Config) Validate() error {
	if config.UpdateInterval < MinUpdateInterval || config.UpdateInterval > MaxUpdateInterval {
		return fmt.Errorf("%w: update interval must be between %d and %d minutes", ErrInvalidConfig, MinUpdateInterval, MaxUpdateInterval)
	}

	port, err := strconv.Atoi(config.Port)
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("%w: port must be a number between 1 and 65535", ErrInvalidConfig)
	}

	if config.WorkingCheckLevel != 1 && config.WorkingCheckLevel != 2 {
		return fmt.Errorf("%w: working check level must be 1 or 2", ErrInvalidConfig)
	}

	return nil
}

// RestartRequiredFields returns json names of the fields changed since start that need a restart to apply
func (config *Config) RestartRequiredFields() []string {
	config.RLock()
	defer config.RUnlock()

	fields := []string{}
	if config.Port != config.boot.Port {
		fields = append(fields, "port")
	}
	if config.SubscriptionPath != config.boot.SubscriptionPath {
		fields = append(fields, "subscription_path")
	}
	if config.AppName != config.boot.AppName {
		fields = append(fields, "app_name")
	}
	return fields
}

func DefaultConfig(configPath string) *Config {
	logging.Log.Warn("file config.json not found. using defaults.")

	currentConfig := newDefaultConfig()
	defaultJSON, err := json.MarshalIndent(currentConfig, "", "  ")
	if err != nil {
		logging.Log.Error("failed to marshal default config", zap.Error(err))
		os.Exit(1)
	}

	if err := os.WriteFile(configPath, defaultJSON, 0644); err != nil {
		logging.Log.Error("failed to create file config.json", zap.Error(err))
		os.Exit(1)
	}

	currentConfig.captureBootValues()
	return currentConfig
}

// Set replaces the dashboard-editable settings and saves them. AutoStart is managed from the tray (see SetAutoStart)
func (config *Config) Set(new *Config) error {
	if err := new.Validate(); err != nil {
		return err
	}

	config.Lock()
	defer config.Unlock()

	config.AppName = new.AppName
	config.SubscriptionTitle = new.SubscriptionTitle
	config.DescriptionText = new.DescriptionText
	config.Port = new.Port
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

// SetAutoStart updates and saves the autostart preference
func (config *Config) SetAutoStart(enabled bool) error {
	config.Lock()
	defer config.Unlock()

	config.AutoStart = enabled
	if err := config.Save(); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	return nil
}

// Save writes the config to disk. The caller must hold the lock (or own the config exclusively)
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
		case AutoStart:
			cfg.AutoStart = config.AutoStart
		}
	}

	return &cfg
}
