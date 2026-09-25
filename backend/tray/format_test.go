package tray

import (
	"testing"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
)

func TestPluralRu(t *testing.T) {
	tests := map[int]string{0: "конфигов", 1: "конфиг", 2: "конфига", 4: "конфига", 5: "конфигов", 11: "конфигов", 12: "конфигов", 21: "конфиг", 22: "конфига", 100: "конфигов", 101: "конфиг", 111: "конфигов", 1247: "конфигов"}
	for n, want := range tests {
		if got := pluralRu(n, "конфиг", "конфига", "конфигов"); got != want {
			t.Errorf("pluralRu(%d) = %q, want %q", n, got, want)
		}
	}
}

func TestGroupThousands(t *testing.T) {
	tests := map[int]string{0: "0", 999: "999", 1000: "1,000", 1247: "1,247", 1234567: "1,234,567", -1234: "-1,234"}
	for n, want := range tests {
		if got := groupThousands(n, ","); got != want {
			t.Errorf("groupThousands(%d) = %q, want %q", n, got, want)
		}
	}
}

func TestFormatConfigsCount(t *testing.T) {
	tests := []struct {
		l    lang
		n    int
		want string
	}{
		{langEN, 1, "1 config"},
		{langEN, 1247, "1,247 configs"},
		{langRU, 1, "1 конфиг"},
		{langRU, 1247, "1 247 конфигов"},
	}
	for _, tt := range tests {
		if got := formatConfigsCount(tt.l, tt.n); got != tt.want {
			t.Errorf("formatConfigsCount(%d, %d) = %q, want %q", tt.l, tt.n, got, tt.want)
		}
	}
}

func TestFormatAgo(t *testing.T) {
	tests := []struct {
		d       time.Duration
		ru, eng string
	}{
		{-time.Second, "только что", "just now"},
		{time.Minute - 1, "только что", "just now"},
		{time.Minute, "1 мин назад", "1 min ago"},
		{59 * time.Minute, "59 мин назад", "59 min ago"},
		{time.Hour, "1 ч назад", "1 h ago"},
		{90 * time.Minute, "1 ч назад", "1 h ago"},
		{24*time.Hour - 1, "23 ч назад", "23 h ago"},
		{24 * time.Hour, "1 дн назад", "1 d ago"},
		{100 * 24 * time.Hour, "100 дн назад", "100 d ago"},
	}
	for _, tt := range tests {
		if got := formatAgo(langRU, tt.d); got != tt.ru {
			t.Errorf("formatAgo(ru, %s) = %q, want %q", tt.d, got, tt.ru)
		}
		if got := formatAgo(langEN, tt.d); got != tt.eng {
			t.Errorf("formatAgo(en, %s) = %q, want %q", tt.d, got, tt.eng)
		}
	}
}

func TestFormatInterval(t *testing.T) {
	tests := []struct {
		minutes int
		ru, eng string
	}{
		{30, "30 мин", "30 min"},
		{60, "1 ч", "1 h"},
		{90, "1 ч 30 мин", "1 h 30 min"},
		{180, "3 ч", "3 h"},
		{360, "6 ч", "6 h"},
		{1440, "24 ч", "24 h"},
		{0, "0 мин", "0 min"},
	}
	for _, tt := range tests {
		if got := formatInterval(langRU, tt.minutes); got != tt.ru {
			t.Errorf("formatInterval(ru, %d) = %q, want %q", tt.minutes, got, tt.ru)
		}
		if got := formatInterval(langEN, tt.minutes); got != tt.eng {
			t.Errorf("formatInterval(en, %d) = %q, want %q", tt.minutes, got, tt.eng)
		}
	}
}

func TestFormatUntil(t *testing.T) {
	now := time.Date(2026, 9, 25, 10, 0, 0, 0, time.Local)

	if got := formatUntil(time.Date(2026, 9, 25, 18, 30, 0, 0, time.Local), now); got != "18:30" {
		t.Errorf("same day: got %q", got)
	}
	if got := formatUntil(time.Date(2026, 9, 26, 9, 5, 0, 0, time.Local), now); got != "26.09 09:05" {
		t.Errorf("next day: got %q", got)
	}
	if got := formatUntil(time.Date(2027, 9, 25, 18, 30, 0, 0, time.Local), now); got != "25.09 18:30" {
		t.Errorf("same day next year: got %q", got)
	}
}

func TestDisplayVersion(t *testing.T) {
	for version, want := range map[string]string{"1.6.0": "v1.6.0", "dev": "dev", "": ""} {
		if got := displayVersion(version); got != want {
			t.Errorf("displayVersion(%q) = %q, want %q", version, got, want)
		}
	}
}

func TestStatusLine(t *testing.T) {
	now := time.Date(2026, 9, 25, 10, 0, 0, 0, time.Local)
	updated := now.Add(-5 * time.Minute)

	tests := []struct {
		name string
		s    snapshot
		want string
	}{
		{"waiting for the first update", snapshot{lang: langRU}, "● Ожидание первого обновления…"},
		{"active", snapshot{lang: langRU, amount: 1247, lastUpdate: updated}, "● 1 247 конфигов · обновлено 5 мин назад"},
		{"active in English", snapshot{lang: langEN, amount: 1247, lastUpdate: updated}, "● 1,247 configs · updated 5 min ago"},
		{"updating", snapshot{lang: langRU, updating: true, amount: 5, lastUpdate: updated}, "↻ Идёт обновление…"},
		{"updating has priority over failure", snapshot{lang: langEN, updating: true, failing: true}, "↻ Updating…"},
		{"paused for a while", snapshot{lang: langRU, paused: true, until: now.Add(3 * time.Hour), amount: 1, lastUpdate: updated}, "⏸ Пауза до 13:00 · 1 конфиг"},
		{"paused forever", snapshot{lang: langEN, paused: true, forever: true, amount: 42, lastUpdate: updated}, "⏸ Paused · 42 configs"},
		{"paused without data", snapshot{lang: langRU, paused: true, forever: true}, "⏸ Пауза"},
		{"failing", snapshot{lang: langRU, failing: true, amount: 1247, lastUpdate: updated}, "⚠ Не удалось обновить · 1 247 конфигов"},
		{"failing without data", snapshot{lang: langEN, failing: true}, "⚠ Update failed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.s.statusLine(now); got != tt.want {
				t.Errorf("statusLine = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTitles(t *testing.T) {
	now := time.Date(2026, 9, 25, 10, 0, 0, 0, time.Local)

	check := func(name, got, want string) {
		t.Helper()
		if got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}

	check("checkLevelTitle deep", snapshot{lang: langRU, level: config.WorkingCheckSingBox}.checkLevelTitle(), "Проверка конфигов: глубокая")
	check("checkLevelTitle fast", snapshot{lang: langEN, level: config.WorkingCheckPing}.checkLevelTitle(), "Configs check: fast")
	check("autoUpdateTitle paused", snapshot{lang: langRU, paused: true}.autoUpdateTitle(), "Автообновление: пауза")
	check("autoUpdateTitle on", snapshot{lang: langEN}.autoUpdateTitle(), "Auto-update: on")
	check("intervalTitle", snapshot{lang: langRU, interval: 90}.intervalTitle(), "Интервал обновления: 1 ч 30 мин")
	check("tooltip", snapshot{lang: langEN, version: "1.6.0", amount: 3, lastUpdate: now.Add(-5 * time.Minute)}.tooltip(now), "Whitelist Download v1.6.0\n3 configs · updated 5 min ago")
	check("tooltip without version", snapshot{lang: langEN, paused: true, forever: true}.tooltip(now), "Whitelist Download\nPaused")
}

func TestAppUpdateTitle(t *testing.T) {
	tests := []struct {
		name    string
		s       snapshot
		title   string
		enabled bool
	}{
		{"not checked yet", snapshot{lang: langRU, version: "1.6.0"}, "Проверить обновления · v1.6.0", true},
		{"dev build", snapshot{lang: langEN, version: "dev"}, "Check for updates · dev", true},
		{"checking", snapshot{lang: langEN, update: appUpdate{status: updateChecking}}, "Checking for updates…", false},
		{"available", snapshot{lang: langRU, update: appUpdate{status: updateAvailable, version: "1.7.0"}}, "⬆ Обновить до v1.7.0", true},
		{"downloading", snapshot{lang: langEN, update: appUpdate{status: updateDownloading, progress: 45}}, "Downloading the update… 45%", false},
		{"installing", snapshot{lang: langRU, update: appUpdate{status: updateInstalling}}, "Установка обновления…", false},
		{"error", snapshot{lang: langEN, update: appUpdate{status: updateError}}, "⚠ Update error — retry", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			title, enabled := tt.s.appUpdateTitle()
			if title != tt.title || enabled != tt.enabled {
				t.Errorf("appUpdateTitle = (%q, %v), want (%q, %v)", title, enabled, tt.title, tt.enabled)
			}
		})
	}
}

func TestIconKind(t *testing.T) {
	tests := []struct {
		s    snapshot
		want iconKind
	}{
		{snapshot{}, iconNormal},
		{snapshot{failing: true}, iconError},
		{snapshot{paused: true}, iconPaused},
		{snapshot{paused: true, failing: true}, iconPaused},
	}
	for _, tt := range tests {
		if got := tt.s.iconKind(); got != tt.want {
			t.Errorf("iconKind(%+v) = %d, want %d", tt.s, got, tt.want)
		}
	}
}
