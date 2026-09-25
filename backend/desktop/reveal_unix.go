//go:build !windows

package desktop

import (
	"os"
	"path/filepath"
	"runtime"
)

func reveal(path string) error {
	if runtime.GOOS == "darwin" {
		if _, err := os.Stat(path); err == nil {
			return run("open", "-R", path)
		}
		return run("open", filepath.Dir(path))
	}

	return run("xdg-open", filepath.Dir(path))
}
