package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
	"github.com/goccy/go-json"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// ConfigsFileName is the name of the local configs cache file inside the app data directory
const ConfigsFileName = "configs.txt"

// ConfigsFilePath returns the path of the configs cache file.
// The file lives in the XDG data directory; a file left next to the executable by old versions is moved there.
func ConfigsFilePath() string {
	dataFilePath, err := xdg.DataFile(filepath.Join("whitelist-download", ConfigsFileName))
	if err != nil {
		logging.Log.Error("failed to resolve data directory, using working directory", zap.Error(err))
		return ConfigsFileName
	}

	if exeDir := executableDir(); exeDir != "" {
		if err := moveIfTargetMissing(filepath.Join(exeDir, ConfigsFileName), dataFilePath); err != nil {
			logging.Log.Error("failed to move configs file into data directory", zap.Error(err))
		}
	}

	return dataFilePath
}

// migrateLegacyConfigsPath handles the removed "configs_path" setting.
// Old versions only used the base name of that setting inside the data directory,
// so a custom name is renamed to the default one when the default file doesn't exist yet.
// Returns true when config.json still contains the legacy key and should be re-saved without it.
func migrateLegacyConfigsPath(fileData []byte) (bool, error) {
	var legacy struct {
		ConfigsPath *string `json:"configs_path"`
	}
	if err := json.Unmarshal(fileData, &legacy); err != nil {
		return false, fmt.Errorf("parse legacy fields: %w", err)
	}
	if legacy.ConfigsPath == nil {
		return false, nil
	}

	baseName := filepath.Base(*legacy.ConfigsPath)
	if baseName == "" || baseName == "." || baseName == ConfigsFileName {
		return true, nil
	}

	target := ConfigsFilePath()
	candidates := []string{filepath.Join(filepath.Dir(target), baseName)}
	if exeDir := executableDir(); exeDir != "" {
		candidates = append(candidates, filepath.Join(exeDir, baseName))
	}
	for _, candidate := range candidates {
		if err := moveIfTargetMissing(candidate, target); err != nil {
			return false, fmt.Errorf("move %s: %w", candidate, err)
		}
	}

	logging.Log.Info("legacy configs_path setting migrated", zap.String("from", baseName), zap.String("to", target))
	return true, nil
}

// moveIfTargetMissing renames src to dst only when src exists and dst doesn't, so no data is ever overwritten
func moveIfTargetMissing(src, dst string) error {
	if src == dst {
		return nil
	}
	if _, err := os.Stat(src); err != nil {
		return nil
	}
	if _, err := os.Stat(dst); !os.IsNotExist(err) {
		return nil
	}
	return os.Rename(src, dst)
}

func executableDir() string {
	exePath, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exePath)
}
