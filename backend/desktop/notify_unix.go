//go:build !windows

package desktop

import "runtime"

func notify(title, message string) error {
	if runtime.GOOS == "darwin" {
		// The title and the message are passed as arguments of the script, so they can't break out of it.
		return run("osascript",
			"-e", "on run argv",
			"-e", "display notification (item 2 of argv) with title (item 1 of argv)",
			"-e", "end run",
			title, message)
	}

	return run("notify-send", "--app-name", AppName, "--", title, message)
}
