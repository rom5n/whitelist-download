package tray

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
)

// Statuses of domain.SafeUpdaterState that the menu reacts to.
const (
	updateChecking    = "checking"
	updateAvailable   = "available"
	updateDownloading = "downloading"
	updateInstalling  = "installing"
	updateError       = "error"
)

// iconKind selects the tray icon.
type iconKind int

const (
	iconNormal iconKind = iota
	iconPaused
	iconError
)

// appUpdate is the state of the app self-update.
type appUpdate struct {
	status   string
	version  string // Version to update to
	progress int    // Download progress, 0-100
}

// snapshot is everything the tray menu shows; it is rendered into titles that are compared between
// refreshes to skip redundant native updates.
type snapshot struct {
	lang          lang
	paused        bool
	forever       bool
	until         time.Time // Zero unless paused for a limited time
	level         int
	interval      int // Update interval in minutes
	updating      bool
	failing       bool      // The latest update failed
	amount        int       // Amount of configs
	lastUpdate    time.Time // Zero if configs were not updated yet
	autoStart     bool
	notifications bool
	language      string // Config.Language setting
	update        appUpdate
	version       string // Current app version
}

func (s snapshot) statusLine(now time.Time) string {
	count := ""
	if s.amount > 0 {
		count = " · " + formatConfigsCount(s.lang, s.amount)
	}

	switch {
	case s.updating:
		return msgStatusUpdating.in(s.lang)
	case s.paused:
		line := msgStatusPaused.in(s.lang)
		if !s.forever {
			line += msgUntil.in(s.lang) + formatUntil(s.until, now)
		}
		return line + count
	case s.failing:
		return msgStatusFailed.in(s.lang) + count
	case s.lastUpdate.IsZero():
		return msgStatusWaiting.in(s.lang)
	default:
		return "● " + formatConfigsCount(s.lang, s.amount) + " · " + msgUpdatedAgo.in(s.lang) + formatAgo(s.lang, now.Sub(s.lastUpdate))
	}
}

// tooltip is shown when hovering the tray icon: the name, the version and the status without its symbol.
func (s snapshot) tooltip(now time.Time) string {
	name := "Whitelist Download"
	if s.version != "" {
		name += " " + displayVersion(s.version)
	}
	return name + "\n" + strings.TrimLeft(s.statusLine(now), "●⏸↻⚠ ")
}

func (s snapshot) iconKind() iconKind {
	switch {
	case s.paused:
		return iconPaused
	case s.failing:
		return iconError
	default:
		return iconNormal
	}
}

func (s snapshot) autoUpdateTitle() string {
	if s.paused {
		return msgAutoUpdatePaused.in(s.lang)
	}
	return msgAutoUpdateOn.in(s.lang)
}

func (s snapshot) intervalTitle() string {
	return msgIntervalTitle.in(s.lang) + ": " + formatInterval(s.lang, s.interval)
}

func (s snapshot) checkLevelTitle() string {
	name := msgCheckFastName
	if s.level == config.WorkingCheckSingBox {
		name = msgCheckDeepName
	}
	return msgCheckTitle.in(s.lang) + ": " + name.in(s.lang)
}

// appUpdateTitle is the title of the app update item and whether clicking it does anything.
func (s snapshot) appUpdateTitle() (title string, enabled bool) {
	switch s.update.status {
	case updateChecking:
		return msgCheckingUpdates.in(s.lang), false
	case updateAvailable:
		return updateAvailableTitle(s.lang, s.update.version), true
	case updateDownloading:
		return fmt.Sprintf("%s %d%%", text{"Downloading the update…", "Загрузка обновления…"}.in(s.lang), s.update.progress), false
	case updateInstalling:
		return msgInstalling.in(s.lang), false
	case updateError:
		return msgUpdateFailed.in(s.lang), true
	default:
		title = msgCheckUpdates.in(s.lang)
		if s.version != "" {
			title += " · " + displayVersion(s.version)
		}
		return title, true
	}
}

// displayVersion adds the "v" prefix to release versions ("1.6.0" -> "v1.6.0") and keeps others ("dev") as is.
func displayVersion(version string) string {
	if version != "" && version[0] >= '0' && version[0] <= '9' {
		return "v" + version
	}
	return version
}

func formatConfigsCount(l lang, n int) string {
	if l == langRU {
		return groupThousands(n, " ") + " " + pluralRu(n, "конфиг", "конфига", "конфигов")
	}

	noun := "configs"
	if n == 1 {
		noun = "config"
	}
	return groupThousands(n, ",") + " " + noun
}

// pluralRu selects the Russian noun form for n: 1 конфиг, 2 конфига, 5 конфигов.
func pluralRu(n int, one, few, many string) string {
	n = max(n, -n)
	switch {
	case n%100 >= 11 && n%100 <= 14:
		return many
	case n%10 == 1:
		return one
	case n%10 >= 2 && n%10 <= 4:
		return few
	default:
		return many
	}
}

// groupThousands formats 1234567 as "1 234 567" with the given separator.
func groupThousands(n int, separator string) string {
	digits := strconv.Itoa(n)
	sign := ""
	if n < 0 {
		sign, digits = "-", digits[1:]
	}

	var b strings.Builder
	b.WriteString(sign)
	for i, r := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteString(separator)
		}
		b.WriteRune(r)
	}
	return b.String()
}

func formatAgo(l lang, d time.Duration) string {
	if l == langRU {
		switch {
		case d < time.Minute:
			return "только что"
		case d < time.Hour:
			return fmt.Sprintf("%d мин назад", int(d/time.Minute))
		case d < 24*time.Hour:
			return fmt.Sprintf("%d ч назад", int(d/time.Hour))
		default:
			return fmt.Sprintf("%d дн назад", int(d/(24*time.Hour)))
		}
	}

	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%d min ago", int(d/time.Minute))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d h ago", int(d/time.Hour))
	default:
		return fmt.Sprintf("%d d ago", int(d/(24*time.Hour)))
	}
}

// formatInterval formats minutes as "30 min", "1 h" or "1 h 30 min" ("30 мин", "1 ч", "1 ч 30 мин").
func formatInterval(l lang, minutes int) string {
	hours, rest := minutes/60, minutes%60
	hourUnit, minuteUnit := "h", "min"
	if l == langRU {
		hourUnit, minuteUnit = "ч", "мин"
	}

	var parts []string
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%d %s", hours, hourUnit))
	}
	if rest > 0 || hours == 0 {
		parts = append(parts, fmt.Sprintf("%d %s", rest, minuteUnit))
	}
	return strings.Join(parts, " ")
}

// formatUntil formats the resume time: "18:30" for today, "26.09 18:30" for other days.
func formatUntil(until, now time.Time) string {
	until, now = until.Local(), now.Local()
	if until.YearDay() == now.YearDay() && until.Year() == now.Year() {
		return until.Format("15:04")
	}
	return until.Format("02.01 15:04")
}
