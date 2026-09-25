// Package desktop integrates with the desktop environment: clipboard, file manager and notifications.
// It uses the tools that ship with each OS instead of third-party libraries.
package desktop

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const commandTimeout = 10 * time.Second

// AppName is shown as the source of desktop notifications.
const AppName = "Whitelist Download"

// CopyToClipboard puts the text into the system clipboard.
func CopyToClipboard(text string) error {
	var candidates [][]string

	switch runtime.GOOS {
	case "windows":
		candidates = [][]string{{"clip.exe"}}
	case "darwin":
		candidates = [][]string{{"pbcopy"}}
	default:
		candidates = [][]string{{"wl-copy"}, {"xclip", "-selection", "clipboard"}, {"xsel", "--clipboard", "--input"}}
	}

	var errs []error
	for _, candidate := range candidates {
		if _, err := exec.LookPath(candidate[0]); err != nil {
			errs = append(errs, err)
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
		cmd := exec.CommandContext(ctx, candidate[0], candidate[1:]...)
		cmd.Stdin = strings.NewReader(text)
		hideWindow(cmd)

		err := cmd.Run()
		cancel()
		if err == nil {
			return nil
		}
		errs = append(errs, fmt.Errorf("%s: %w", candidate[0], err))
	}

	return fmt.Errorf("failed to copy to the clipboard: %w", errors.Join(errs...))
}

// Notify shows a desktop notification.
func Notify(title, message string) error {
	if err := notify(title, message); err != nil {
		return fmt.Errorf("failed to show the notification: %w", err)
	}
	return nil
}

// Reveal shows the file in the system file manager (selected where the OS supports it),
// or just opens the folder if the file does not exist yet.
func Reveal(path string) error {
	if err := reveal(path); err != nil {
		return fmt.Errorf("failed to open %s in the file manager: %w", path, err)
	}
	return nil
}
