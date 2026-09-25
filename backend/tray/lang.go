package tray

import (
	"fmt"
	"strings"
	"sync"

	"github.com/rom5n/whitelist-download/backend/config"
)

// lang is the language of the tray menu and notifications.
type lang int

const (
	langEN lang = iota
	langRU
)

// text is a UI string in every supported language.
type text struct{ en, ru string }

func (t text) in(l lang) string {
	if l == langRU {
		return t.ru
	}
	return t.en
}

// Menu items.
var (
	msgOpenDashboard = text{"Open dashboard", "Открыть дашборд"}
	msgCopyLink      = text{"Copy subscription link", "Скопировать ссылку подписки"}
	msgLinkCopied    = text{"✓ Link copied", "✓ Ссылка скопирована"}
	msgCopyFailed    = text{"⚠ Could not copy the link", "⚠ Не удалось скопировать"}
	msgUpdateNow     = text{"Update now", "Обновить сейчас"}

	msgAutoUpdateOn     = text{"Auto-update: on", "Автообновление: вкл"}
	msgAutoUpdatePaused = text{"Auto-update: paused", "Автообновление: пауза"}
	msgPause1h          = text{"Pause for 1 hour", "Пауза на 1 час"}
	msgPause4h          = text{"Pause for 4 hours", "Пауза на 4 часа"}
	msgPause24h         = text{"Pause for 24 hours", "Пауза на 24 часа"}
	msgPauseForever     = text{"Pause forever", "Пауза навсегда"}
	msgResume           = text{"Resume", "Возобновить"}

	msgIntervalTitle = text{"Update interval", "Интервал обновления"}
	msgCheckFast     = text{"Fast — ping", "Быстрая — ping"}
	msgCheckDeep     = text{"Deep — sing-box", "Глубокая — sing-box"}
	msgCheckTitle    = text{"Configs check", "Проверка конфигов"}
	msgCheckFastName = text{"fast", "быстрая"}
	msgCheckDeepName = text{"deep", "глубокая"}

	msgPreferences     = text{"Preferences", "Настройки"}
	msgStartWithSystem = text{"Start with the system", "Запускать при старте системы"}
	msgNotifications   = text{"Notifications", "Уведомления"}
	msgLangAuto        = text{"Language: auto", "Язык: авто"}
	msgLangRU          = text{"Language: Русский", "Язык: Русский"}
	msgLangEN          = text{"Language: English", "Язык: English"}

	msgFiles      = text{"Files", "Файлы"}
	msgFileConfig = text{"Settings (config.json)", "Настройки (config.json)"}
	msgFileLog    = text{"Log (app.log)", "Журнал (app.log)"}

	msgCheckUpdates    = text{"Check for updates", "Проверить обновления"}
	msgCheckingUpdates = text{"Checking for updates…", "Проверка обновлений…"}
	msgInstalling      = text{"Installing the update…", "Установка обновления…"}
	msgUpdateFailed    = text{"⚠ Update error — retry", "⚠ Ошибка обновления — повторить"}

	msgQuit = text{"Quit", "Выход"}
)

// Status line.
var (
	msgStatusUpdating = text{"↻ Updating…", "↻ Идёт обновление…"}
	msgStatusPaused   = text{"⏸ Paused", "⏸ Пауза"}
	msgStatusFailed   = text{"⚠ Update failed", "⚠ Не удалось обновить"}
	msgStatusWaiting  = text{"● Waiting for the first update…", "● Ожидание первого обновления…"}
	msgUntil          = text{" until ", " до "}
	msgUpdatedAgo     = text{"updated ", "обновлено "}
)

// Notifications.
var (
	msgNotifyFailed = text{"Could not update configs. See the log for details.", "Не удалось обновить конфиги. Подробности в журнале."}
)

func configsFileTitle(l lang, name string) string {
	return fmt.Sprintf(text{"Configs (%s)", "Конфиги (%s)"}.in(l), name)
}

func updateAvailableTitle(l lang, version string) string {
	return fmt.Sprintf(text{"⬆ Update to %s", "⬆ Обновить до %s"}.in(l), displayVersion(version))
}

// languageFromLocale maps a locale or a language tag ("ru_RU.UTF-8", "ru-RU", "en") to a tray language.
func languageFromLocale(locale string) lang {
	locale = strings.ToLower(strings.TrimSpace(locale))
	if locale == "ru" || strings.HasPrefix(locale, "ru_") || strings.HasPrefix(locale, "ru-") || strings.HasPrefix(locale, "ru.") {
		return langRU
	}
	return langEN
}

var systemLang = sync.OnceValue(detectSystemLanguage)

// resolveLanguage turns Config.Language into a tray language; "auto" follows the system language.
func resolveLanguage(setting string) lang {
	switch setting {
	case config.LanguageRU:
		return langRU
	case config.LanguageEN:
		return langEN
	default:
		return systemLang()
	}
}
