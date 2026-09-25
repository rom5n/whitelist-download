// Package startup registers the app in the OS autostart. Add and Remove are implemented per OS.
package startup

import "github.com/rom5n/whitelist-download/backend/config"

// Apply adds the app to the autostart or removes it, according to Config.AutoStart.
func Apply(cfg *config.Config) {
	if cfg.RetrieveSafe(config.AutoStart).AutoStart {
		Add(cfg)
		return
	}

	Remove(cfg)
}
