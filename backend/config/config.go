package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/paths"
	"go.uber.org/zap"

	"github.com/adrg/xdg"
	"github.com/goccy/go-json"
)

// Working check levels for Config.WorkingCheckLevel.
const (
	WorkingCheckPing    = 1 // TCP dial to the server (fast)
	WorkingCheckSingBox = 2 // real request through a sing-box core (slow, more accurate)
)

// PausedForever is the Config.PausedUntil value for updates paused until resumed manually.
const PausedForever int64 = -1

// Values for Config.Language.
const (
	LanguageAuto = "auto" // Follow the system language
	LanguageRU   = "ru"
	LanguageEN   = "en"
)

// MaxUpdateInterval is the longest allowed Config.UpdateInterval (one week), in minutes.
const MaxUpdateInterval = 7 * 24 * 60

var (
	ErrInvalidCheckLevel = errors.New("invalid working check level")
	ErrInvalidInterval   = errors.New("invalid update interval")
	ErrInvalidLanguage   = errors.New("invalid language")
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
	PausedUntil       Field = "PausedUntil"
	AutoStart         Field = "AutoStart"
	Notifications     Field = "Notifications"
	Language          Field = "Language"
)

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
	PausedUntil       int64    `json:"paused_until"`             // Configs auto update pause: 0 - not paused, -1 (PausedForever) - until resumed manually, >0 - Unix time when it resumes
	AutoStart         bool     `json:"auto_start"`               // Start the app together with the system
	Notifications     bool     `json:"notifications"`            // Show desktop notifications about updates
	Language          string   `json:"language"`                 // System tray language: "auto" (system language), "ru" or "en"

	started startedWith // Settings the app was started with, see MarkStarted
}

// newDefaultConfig Returns default app config
func newDefaultConfig() *Config {
	return &Config{
		AppName:           "WhitelistsDownload",
		SubscriptionTitle: "🌊 OpenSource VPN",
		DescriptionText:   "⚡ Subscriptions from open sources",
		Port:              "55000",
		SubscriptionPath:  "/sub",
		UpdateInterval:    15,
		ForcedIP:          "",
		WorkingCheckLevel: 1,
		AutoUpdateMajor:   false,
		AutoUpdatePatch:   true,
		AutoBrowserOpen:   true,
		AutoStart:         true,
		Notifications:     true,
		Language:          LanguageAuto,
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

	if err = paths.MigrateLegacy("config.json", configPath); err != nil {
		logging.Log.Warn("failed to migrate legacy config.json", zap.Error(err))
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
	migrateConfigsPath(fileData)

	currentConfig.MarkStarted()
	return currentConfig
}

// migrateConfigsPath handles the removed "configs_path" setting: the configs file always has the name
// paths.ConfigsFileName now. A file with a custom name is renamed, so the subscription keeps working until the
// next update rewrites it. The key itself is dropped from config.json on the next save.
func migrateConfigsPath(fileData []byte) {
	var legacy struct {
		ConfigsPath string `json:"configs_path"`
	}
	if err := json.Unmarshal(fileData, &legacy); err != nil || strings.TrimSpace(legacy.ConfigsPath) == "" {
		return
	}

	if err := paths.RenameDataFile(legacy.ConfigsPath, paths.ConfigsFileName); err != nil {
		logging.Log.Warn("failed to migrate the configs file, it is recreated on the next update",
			zap.String("configs_path", legacy.ConfigsPath), zap.Error(err))
	}
}

func DefaultConfig(configPath string) *Config {
	logging.Log.Warn("file config.json not found. using defaults.")

	currentConfig := newDefaultConfig()
	defaultJSON, _ := json.MarshalIndent(currentConfig, "", "  ")

	if err := os.WriteFile(configPath, defaultJSON, 0644); err != nil {
		logging.Log.Error("failed to create file config.json", zap.Error(err))
		os.Exit(1)
	}

	currentConfig.MarkStarted()
	return currentConfig
}

func (config *Config) Set(new *Config) error {
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
	// PausedUntil, AutoStart, Notifications and Language are intentionally not copied: they are managed
	// from the system tray via their own setters, so saving a (possibly stale) settings form can't change them.

	if err := config.Save(); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	return nil
}

// setAndSave sets the config field under the lock and persists the config; the field is restored if saving fails.
func setAndSave[T any](config *Config, field *T, value T) error {
	config.Lock()
	defer config.Unlock()

	previous := *field
	*field = value
	if err := config.Save(); err != nil {
		*field = previous
		return fmt.Errorf("save config: %w", err)
	}

	return nil
}

// SetWorkingCheckLevel changes the working check level and persists the config.
func (config *Config) SetWorkingCheckLevel(level int) error {
	if level != WorkingCheckPing && level != WorkingCheckSingBox {
		return fmt.Errorf("%w: %d", ErrInvalidCheckLevel, level)
	}

	return setAndSave(config, &config.WorkingCheckLevel, level)
}

// SetPausedUntil changes the configs auto update pause (see Config.PausedUntil) and persists the config.
func (config *Config) SetPausedUntil(until int64) error {
	return setAndSave(config, &config.PausedUntil, until)
}

// SetUpdateInterval changes the configs auto update interval (in minutes) and persists the config.
func (config *Config) SetUpdateInterval(minutes int) error {
	if minutes < 1 || minutes > MaxUpdateInterval {
		return fmt.Errorf("%w: %d minutes", ErrInvalidInterval, minutes)
	}

	return setAndSave(config, &config.UpdateInterval, minutes)
}

// SetAutoStart changes whether the app starts with the system and persists the config.
func (config *Config) SetAutoStart(enabled bool) error {
	return setAndSave(config, &config.AutoStart, enabled)
}

// SetNotifications changes whether desktop notifications are shown and persists the config.
func (config *Config) SetNotifications(enabled bool) error {
	return setAndSave(config, &config.Notifications, enabled)
}

// SetLanguage changes the system tray language (LanguageAuto, LanguageRU or LanguageEN) and persists the config.
func (config *Config) SetLanguage(language string) error {
	switch language {
	case LanguageAuto, LanguageRU, LanguageEN:
	default:
		return fmt.Errorf("%w: %q", ErrInvalidLanguage, language)
	}

	return setAndSave(config, &config.Language, language)
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
		case PausedUntil:
			cfg.PausedUntil = config.PausedUntil
		case AutoStart:
			cfg.AutoStart = config.AutoStart
		case Notifications:
			cfg.Notifications = config.Notifications
		case Language:
			cfg.Language = config.Language
		}
	}

	return &cfg
}
