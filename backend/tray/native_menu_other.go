//go:build !windows

package tray

import "context"

// setupNativeMenu is a no-op outside Windows: macOS (NSMenu) and Linux (AppIndicator/GTK) menus
// already follow the system theme and use the platform's rounded menu style.
func setupNativeMenu(ctx context.Context) {}
