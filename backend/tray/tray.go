package tray

import (
	"context"
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/getlantern/systray"
	"github.com/rom5n/whitelist-download/backend/browser"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/startup"
	"go.uber.org/zap"
)

// autostartRefreshInterval keeps the checkbox in sync with changes made outside the app
// (e.g. Task Manager → Startup apps). Native menus give no "menu opened" event on every OS, so it is polled.
const autostartRefreshInterval = 2 * time.Second

// Run initializes and runs the system tray. It blocks the current thread.
func Run(ctx context.Context, cancel context.CancelFunc, cfg *config.Config, startApp func()) {
	// The app name is part of the autostart entry; a renamed app applies only after a restart
	appName := cfg.RetrieveSafe(config.AppName).AppName

	setupNativeMenu(ctx)

	onReady := func() {
		if runtime.GOOS == "windows" {
			systray.SetIcon(iconWin)
		} else {
			systray.SetIcon(iconMac)
		}
		systray.SetTitle(appName)
		systray.SetTooltip("Whitelist Download")

		// Create menu items
		mOpen := systray.AddMenuItem("Дашборд", "Открытие дашборда в браузере")
		mUpdate := systray.AddMenuItem("Обновить конфиги", "Принудительное обновление конфигов")
		systray.AddSeparator()
		mAutostart := systray.AddMenuItemCheckbox("Автозапуск", "Запускать вместе с системой", autostartState(appName, cfg))
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Закрыть", "Quit the application")

		// Start the actual background tasks of the application
		go startApp()

		refresh := time.NewTicker(autostartRefreshInterval)

		// Handle tray menu events
		go func() {
			defer refresh.Stop()
			for {
				select {
				case <-mOpen.ClickedCh:
					browser.Open(cfg.Port, true)
				case <-mUpdate.ClickedCh:
					go func() {
						url := fmt.Sprintf("http://127.0.0.1:%s/api/update-configs", cfg.Port)
						resp, err := http.Get(url)
						if err != nil {
							logging.Log.Error("Failed to trigger force update from tray", zap.Error(err))
						} else {
							resp.Body.Close()
							logging.Log.Info("Force update triggered from tray")
						}
					}()
				case <-mAutostart.ClickedCh:
					toggleAutostart(appName, cfg, mAutostart)
				case <-refresh.C:
					setChecked(mAutostart, autostartState(appName, cfg))
				case <-mQuit.ClickedCh:
					cancel()
					systray.Quit()
					return
				case <-ctx.Done():
					systray.Quit()
					return
				}
			}
		}()
	}

	onExit := func() {
		logging.Log.Info("System tray exited")
	}

	systray.Run(onReady, onExit)
}

// autostartState returns the real OS state, falling back to the saved preference if it can't be read
func autostartState(appName string, cfg *config.Config) bool {
	enabled, err := startup.IsEnabled(appName)
	if err != nil {
		logging.Log.Warn("failed to read autostart state", zap.Error(err))
		return cfg.RetrieveSafe(config.AutoStart).AutoStart
	}
	return enabled
}

func toggleAutostart(appName string, cfg *config.Config, item *systray.MenuItem) {
	enabled := !item.Checked()

	if err := startup.Apply(appName, enabled); err != nil {
		logging.Log.Error("failed to change autostart from tray", zap.Error(err))
		setChecked(item, autostartState(appName, cfg))
		return
	}

	if err := cfg.SetAutoStart(enabled); err != nil {
		logging.Log.Error("failed to save autostart preference", zap.Error(err))
	}

	setChecked(item, enabled)
}

func setChecked(item *systray.MenuItem, checked bool) {
	if item.Checked() == checked {
		return
	}
	if checked {
		item.Check()
	} else {
		item.Uncheck()
	}
}
