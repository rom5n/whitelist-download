//go:build !windows

package tray

import "context"

// watchNativeLook does nothing outside Windows: macOS menus and GTK menus already follow the system
// appearance (light/dark) and corner style.
func watchNativeLook(ctx context.Context) {}
