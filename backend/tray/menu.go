package tray

import (
	"time"

	"github.com/getlantern/systray"
	"github.com/rom5n/whitelist-download/backend/config"
)

// pauseOptions are the "pause for a while" choices of the auto-update submenu.
var pauseOptions = []struct {
	title    text
	duration time.Duration
}{
	{msgPause1h, time.Hour},
	{msgPause4h, 4 * time.Hour},
	{msgPause24h, 24 * time.Hour},
}

// intervalOptions are the update interval presets in minutes.
var intervalOptions = []int{30, 60, 180, 360}

// menu holds the menu items; their titles are set by refresh, since they depend on the language and the state.
type menu struct {
	status, open, copyLink, updateNow *systray.MenuItem

	auto, pauseForever, resume *systray.MenuItem
	pauses                     []*systray.MenuItem // Aligned with pauseOptions

	interval  *systray.MenuItem
	intervals []*systray.MenuItem // Aligned with intervalOptions

	check, fast, deep *systray.MenuItem

	prefs, autoStart, notifications, langAuto, langRU, langEN *systray.MenuItem

	files, fileConfig, fileConfigs, fileLog *systray.MenuItem

	appUpdate, quit *systray.MenuItem
}

func (t *tray) buildMenu() {
	m := &t.menu

	systray.SetIcon(iconData(iconNormal))

	m.status = systray.AddMenuItem("", "")
	m.status.Disable()
	systray.AddSeparator()

	m.open = systray.AddMenuItem("", "")
	m.copyLink = systray.AddMenuItem("", "")
	m.updateNow = systray.AddMenuItem("", "")
	systray.AddSeparator()

	m.auto = systray.AddMenuItem("", "")
	for range pauseOptions {
		m.pauses = append(m.pauses, m.auto.AddSubMenuItem("", ""))
	}
	m.pauseForever = m.auto.AddSubMenuItem("", "")
	m.resume = m.auto.AddSubMenuItem("", "")

	m.interval = systray.AddMenuItem("", "")
	for range intervalOptions {
		m.intervals = append(m.intervals, m.interval.AddSubMenuItemCheckbox("", "", false))
	}

	m.check = systray.AddMenuItem("", "")
	m.fast = m.check.AddSubMenuItemCheckbox("", "", false)
	m.deep = m.check.AddSubMenuItemCheckbox("", "", false)
	systray.AddSeparator()

	m.prefs = systray.AddMenuItem("", "")
	m.autoStart = m.prefs.AddSubMenuItemCheckbox("", "", false)
	m.notifications = m.prefs.AddSubMenuItemCheckbox("", "", false)
	m.langAuto = m.prefs.AddSubMenuItemCheckbox("", "", false)
	m.langRU = m.prefs.AddSubMenuItemCheckbox("", "", false)
	m.langEN = m.prefs.AddSubMenuItemCheckbox("", "", false)

	m.files = systray.AddMenuItem("", "")
	m.fileConfig = m.files.AddSubMenuItem("", "")
	m.fileConfigs = m.files.AddSubMenuItem("", "")
	m.fileLog = m.files.AddSubMenuItem("", "")

	m.appUpdate = systray.AddMenuItem("", "")
	systray.AddSeparator()
	m.quit = systray.AddMenuItem("", "")

	t.bindActions()
}

func (t *tray) bindActions() {
	m := &t.menu

	t.bind(m.open, t.openDashboard)
	t.bind(m.copyLink, t.copyLink)
	t.bind(m.updateNow, t.forceUpdate)

	for i, option := range pauseOptions {
		t.bind(m.pauses[i], func() {
			t.run("pause updates", func() error { return t.scheduler.PauseFor(option.duration) })
		})
	}
	t.bind(m.pauseForever, func() { t.run("pause updates", t.scheduler.PauseForever) })
	t.bind(m.resume, func() { t.run("resume updates", t.scheduler.Resume) })

	for i, minutes := range intervalOptions {
		t.bind(m.intervals[i], func() {
			t.run("change update interval", func() error { return t.scheduler.SetUpdateInterval(minutes) })
		})
	}

	t.bind(m.fast, func() {
		t.run("change check level", func() error { return t.scheduler.SetWorkingCheckLevel(config.WorkingCheckPing) })
	})
	t.bind(m.deep, func() {
		t.run("change check level", func() error { return t.scheduler.SetWorkingCheckLevel(config.WorkingCheckSingBox) })
	})

	t.bind(m.autoStart, t.toggleAutoStart)
	t.bind(m.notifications, t.toggleNotifications)
	t.bind(m.langAuto, func() { t.setLanguage(config.LanguageAuto) })
	t.bind(m.langRU, func() { t.setLanguage(config.LanguageRU) })
	t.bind(m.langEN, func() { t.setLanguage(config.LanguageEN) })

	t.bind(m.fileConfig, func() { t.reveal(t.configFilePath) })
	t.bind(m.fileConfigs, func() { t.reveal(t.configsFilePath) })
	t.bind(m.fileLog, func() { t.reveal(logFilePath) })

	t.bind(m.appUpdate, t.appUpdateAction)

	t.bind(m.quit, func() {
		t.cancel()
		systray.Quit()
	})
}
