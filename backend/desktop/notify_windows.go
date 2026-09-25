package desktop

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"unicode/utf16"

	"golang.org/x/sys/windows/registry"
)

const (
	toastAppID = "WhitelistDownload"
	// AppID of Windows PowerShell: toasts from it are always allowed to show.
	fallbackAppID = `{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe`
)

// The title and the message are passed through the environment, never concatenated into the script.
const toastScript = `
$ErrorActionPreference = 'Stop'
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$title = [System.Security.SecurityElement]::Escape($env:WL_TITLE)
$message = [System.Security.SecurityElement]::Escape($env:WL_MESSAGE)
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$title</text><text>$message</text></binding></visual></toast>")
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:WL_APP_ID).Show($toast)
`

var (
	registerOnce sync.Once
	appID        = fallbackAppID
)

// registerAppID registers the app in HKCU so toasts are shown under its own name.
func registerAppID() {
	registerOnce.Do(func() {
		key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\AppUserModelId\`+toastAppID, registry.SET_VALUE)
		if err != nil {
			return
		}
		defer key.Close()

		if err = key.SetStringValue("DisplayName", AppName); err == nil {
			appID = toastAppID
		}
	})
}

func notify(title, message string) error {
	registerAppID()

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodePowerShell(toastScript))
	cmd.Env = append(os.Environ(), "WL_TITLE="+title, "WL_MESSAGE="+message, "WL_APP_ID="+appID)
	hideWindow(cmd)

	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("powershell: %w: %s", err, out)
	}
	return nil
}

// encodePowerShell encodes the script for the -EncodedCommand argument (base64 of UTF-16LE).
func encodePowerShell(script string) string {
	units := utf16.Encode([]rune(script))
	raw := make([]byte, 0, len(units)*2)
	for _, unit := range units {
		raw = append(raw, byte(unit), byte(unit>>8))
	}
	return base64.StdEncoding.EncodeToString(raw)
}
