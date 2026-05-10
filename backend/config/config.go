package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/goccy/go-json"
)

type Config struct {
	sync.RWMutex      `json:"-"`
	AppName           string   `json:"app_name"`
	SubscriptionTitle string   `json:"subscription_title"`
	DescriptionText   string   `json:"description_text"`
	Port              string   `json:"port" jsonDefault:"55000"`
	ConfigsPath       string   `json:"configs_path"`
	LogsPath          string   `json:"logs_path"`
	SubscriptionPath  string   `json:"subscription_path"`
	UpdateInterval    int      `json:"update_interval_minutes"`
	Sources           []string `json:"sources"`
	ForcedIP          string   `json:"forced_ip"`
}

var defaultConfig = Config{
	AppName:           "WhitelistsDownload",
	SubscriptionTitle: "🌊 OpenSource VPN",
	DescriptionText:   "⚡ Subscriptions from open sources",
	Port:              "55000",
	ConfigsPath:       "configs.txt",
	LogsPath:          "logs.txt",
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
		log.Fatalf("failed to get path: %v", err)
	}
	exeDir := filepath.Dir(exePath)

	configPath := filepath.Join(exeDir, "config.json")

	fileData, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("File config.json not found. Using defaults.")

			defaultJSON, _ := json.MarshalIndent(&defaultConfig, "", "  ")

			if err := os.WriteFile(configPath, defaultJSON, 0644); err != nil {
				log.Fatalf("Не удалось создать config.json: %v", err)
			}

			return &defaultConfig
		}
		log.Fatalf("Ошибка чтения config.json: %v", err)
	}

	var currentConfig Config
	if err := json.Unmarshal(fileData, &currentConfig); err != nil {
		log.Fatalf("Ошибка синтаксиса в config.json: %v\nПожалуйста, исправьте файл или удалите его для сброса.", err)
	}

	return &currentConfig
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
	config.LogsPath = new.LogsPath
	config.ForcedIP = new.ForcedIP

	if err := config.Save(); err != nil {
		return fmt.Errorf("save config: %v", err)
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
