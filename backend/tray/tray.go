package tray

import (
	"context"
	"fmt"
	"net/http"

	"runtime"

	"github.com/getlantern/systray"
	"github.com/rom5n/whitelist-download/backend/browser"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// Run initializes and runs the system tray. It blocks the current thread.
func Run(ctx context.Context, cancel context.CancelFunc, cfg *config.Config, startApp func()) {
	onReady := func() {
		if runtime.GOOS == "windows" {
			systray.SetIcon(iconWin)
		} else {
			systray.SetIcon(iconMac)
		}
		systray.SetTitle(cfg.RetrieveSafe(config.AppName).AppName)
		systray.SetTooltip("Whitelist Download")

		// Create menu items
		mOpen := systray.AddMenuItem("Дашборд", "Открытие дашборда в браузере")
		mUpdate := systray.AddMenuItem("Обновить конфиги", "Принудительное обновление конфигов")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Закрыть", "Quit the application")

		// Start the actual background tasks of the application
		go startApp()

		// Handle tray menu events
		go func() {
			for {
				select {
				case <-mOpen.ClickedCh:
					browser.Open(cfg.RetrieveSafe(config.Port).Port, true)
				case <-mUpdate.ClickedCh:
					port := cfg.RetrieveSafe(config.Port).Port
					go func() {
						url := fmt.Sprintf("http://127.0.0.1:%s/api/update-configs", port)
						resp, err := http.Get(url)
						if err != nil {
							logging.Log.Error("Failed to trigger force update from tray", zap.Error(err))
						} else {
							resp.Body.Close()
							logging.Log.Info("Force update triggered from tray")
						}
					}()
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
