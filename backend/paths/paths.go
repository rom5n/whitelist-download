// Package paths resolves locations of the app's persistent files and migrates
// legacy files that used to live next to the executable.
//
// It must not import other project packages (logging depends on it), so
// errors are returned to callers, which are responsible for logging them.
package paths

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
)

const appDir = "whitelist-download"

// MigrateLegacy moves <exeDir>/<name> to newPath if the legacy file exists and newPath does not.
func MigrateLegacy(name, newPath string) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	oldPath := filepath.Join(filepath.Dir(exePath), name)
	if _, err := os.Stat(oldPath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to stat legacy file %s: %w", oldPath, err)
	}

	if _, err := os.Stat(newPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("failed to stat %s: %w", newPath, err)
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("failed to migrate %s to %s: %w", oldPath, newPath, err)
	}

	return nil
}

// ResolveDataFile returns the path of a file in the XDG data directory, migrating the legacy file if needed.
// The returned path is always usable (falls back to the bare file name if XDG resolution fails);
// a non-nil error is non-fatal and should only be logged.
func ResolveDataFile(fileName string) (string, error) {
	name := filepath.Base(fileName)

	dataPath, err := xdg.DataFile(filepath.Join(appDir, name))
	if err != nil {
		return fileName, fmt.Errorf("failed to resolve data path: %w", err)
	}

	return dataPath, MigrateLegacy(name, dataPath)
}
