//go:build !windows

package tray

import (
	"context"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"time"
)

var quotedTag = regexp.MustCompile(`"([^"]+)"`)

// detectSystemLanguage returns the language of the desktop session.
func detectSystemLanguage() lang {
	if runtime.GOOS == "darwin" {
		// GUI apps on macOS don't get LANG, so ask for the preferred languages: ("ru-RU", "en-US")
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		if out, err := exec.CommandContext(ctx, "defaults", "read", "-g", "AppleLanguages").Output(); err == nil {
			if match := quotedTag.FindSubmatch(out); match != nil {
				return languageFromLocale(string(match[1]))
			}
		}
		return langEN
	}

	for _, name := range []string{"LC_ALL", "LC_MESSAGES", "LANGUAGE", "LANG"} {
		if value := os.Getenv(name); value != "" {
			return languageFromLocale(value)
		}
	}
	return langEN
}
