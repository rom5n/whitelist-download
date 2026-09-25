package tray

import (
	"fmt"

	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/desktop"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

func (t *tray) language() lang {
	return resolveLanguage(t.cfg.RetrieveSafe(config.Language).Language)
}

func (t *tray) notificationsEnabled() bool {
	return t.cfg.RetrieveSafe(config.Notifications).Notifications
}

// notify shows a desktop notification without blocking the caller.
func (t *tray) notify(message string) {
	go func() {
		if err := desktop.Notify(desktop.AppName, message); err != nil {
			logging.Log.Warn("failed to show a notification", zap.Error(err))
		}
	}()
}

// onUpdate is called after every configs update. To avoid spam, scheduled updates are only reported when
// they start failing and when they recover; updates the user asked for are always reported.
func (t *tray) onUpdate(event aggregator.UpdateEvent) {
	failed := event.Err != nil
	wasFailing := t.wasFailing.Swap(failed)

	if !t.notificationsEnabled() {
		return
	}

	l := t.language()
	switch {
	case failed && (event.Manual || !wasFailing):
		t.notify(msgNotifyFailed.in(l))
	case !failed && (event.Manual || wasFailing):
		t.notify(updateSucceededMessage(l, event.Result, wasFailing && !event.Manual))
	}
}

func updateSucceededMessage(l lang, result *aggregator.UpdateResult, recovered bool) string {
	if result == nil {
		return ""
	}

	message := fmt.Sprintf("%s: %s", text{"Updated", "Обновлено"}.in(l), formatConfigsCount(l, result.AmountConfigs))
	if recovered {
		message = fmt.Sprintf("%s: %s", text{"Updates are working again", "Обновление снова работает"}.in(l), formatConfigsCount(l, result.AmountConfigs))
	}

	if result.NotWorking > 0 {
		message += fmt.Sprintf(" · %s: %d", text{"unreachable skipped", "отсеяно недоступных"}.in(l), result.NotWorking)
	}
	return message
}

// notifyNewVersion tells the user once per version that an app update is available.
func (t *tray) notifyNewVersion(s snapshot) {
	if s.update.status != updateAvailable || s.update.version == "" || s.update.version == t.notifiedVersion {
		return
	}
	t.notifiedVersion = s.update.version

	if !s.notifications {
		return
	}
	t.notify(fmt.Sprintf(text{"Version %s is available", "Доступна версия %s"}.in(s.lang), s.update.version))
}
