package tray

import (
	"testing"

	"github.com/rom5n/whitelist-download/backend/config"
)

func TestLanguageFromLocale(t *testing.T) {
	tests := map[string]lang{
		"ru":          langRU,
		"ru_RU.UTF-8": langRU,
		"ru-RU":       langRU,
		"RU":          langRU,
		" ru_UA ":     langRU,
		"en_US.UTF-8": langEN,
		"en-GB":       langEN,
		"de_DE":       langEN,
		"":            langEN,
		"C":           langEN,
		"rus":         langEN,
		"ro_RO":       langEN,
	}
	for locale, want := range tests {
		if got := languageFromLocale(locale); got != want {
			t.Errorf("languageFromLocale(%q) = %d, want %d", locale, got, want)
		}
	}
}

func TestResolveLanguage(t *testing.T) {
	if got := resolveLanguage(config.LanguageRU); got != langRU {
		t.Errorf("ru: got %d", got)
	}
	if got := resolveLanguage(config.LanguageEN); got != langEN {
		t.Errorf("en: got %d", got)
	}

	// "auto" (and anything unknown) follows the system language
	for _, setting := range []string{config.LanguageAuto, "", "klingon"} {
		if got := resolveLanguage(setting); got != systemLang() {
			t.Errorf("%q: got %d, want the system language %d", setting, got, systemLang())
		}
	}
}

// Every message must be translated: a missing translation would show an empty menu item.
func TestMessagesAreTranslated(t *testing.T) {
	messages := []text{
		msgOpenDashboard, msgCopyLink, msgLinkCopied, msgCopyFailed, msgUpdateNow,
		msgAutoUpdateOn, msgAutoUpdatePaused, msgPause1h, msgPause4h, msgPause24h, msgPauseForever, msgResume,
		msgIntervalTitle, msgCheckFast, msgCheckDeep, msgCheckTitle, msgCheckFastName, msgCheckDeepName,
		msgPreferences, msgStartWithSystem, msgNotifications, msgLangAuto, msgLangRU, msgLangEN,
		msgFiles, msgFileConfig, msgFileLog, msgCheckUpdates, msgCheckingUpdates, msgInstalling, msgUpdateFailed, msgQuit,
		msgStatusUpdating, msgStatusPaused, msgStatusFailed, msgStatusWaiting, msgUntil, msgUpdatedAgo, msgNotifyFailed,
	}

	for _, message := range messages {
		if message.en == "" || message.ru == "" {
			t.Errorf("message is not translated: %+v", message)
		}
	}
}
