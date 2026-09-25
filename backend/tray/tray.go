package tray

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/getlantern/systray"
	"github.com/rom5n/whitelist-download/backend/aggregator"
	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

const (
	refreshInterval = time.Second
	flashDuration   = 2 * time.Second // How long "link copied" replaces the title of the copy item
)

type tray struct {
	ctx          context.Context
	cancel       context.CancelFunc
	cfg          *config.Config
	statistics   *domain.Statistics
	scheduler    *aggregator.Scheduler
	updaterState *domain.SafeUpdaterState

	// resync asks the refresh loop to redraw the menu right away and re-apply checkbox states.
	resync chan struct{}

	menu menu

	// Owned by the refresh goroutine (and by onReady before it starts)
	titles          map[*systray.MenuItem]string // Last title set for each item
	resumeShown     bool
	icon            iconKind
	tooltip         string
	notifiedVersion string // App version the user was already notified about

	wasFailing atomic.Bool // The previous update failed (used by notifications)

	flashMu    sync.Mutex
	flashText  text
	flashUntil time.Time
}

// Run initializes and runs the system tray. It blocks the current thread.
//
// Menu layout:
//
//	● 1 247 configs · updated 5 min ago
//	─────
//	Open dashboard / Copy subscription link / Update now
//	─────
//	Auto-update ▸  pause for 1 h / 4 h / 24 h / until resumed, resume
//	Update interval ▸  30 min / 1 h / 3 h / 6 h
//	Configs check ▸  fast (ping) / deep (sing-box)
//	─────
//	Preferences ▸  start with the system, notifications, language
//	Files ▸  config.json, configs.txt, app.log
//	Check for updates / Update to vX.Y.Z
//	─────
//	Quit
//
// The icon is dimmed while updates are paused and gets a red dot when the latest update failed.
func Run(ctx context.Context, cancel context.CancelFunc, cfg *config.Config, statistics *domain.Statistics, scheduler *aggregator.Scheduler, updaterState *domain.SafeUpdaterState, startApp func()) {
	t := &tray{
		ctx:          ctx,
		cancel:       cancel,
		cfg:          cfg,
		statistics:   statistics,
		scheduler:    scheduler,
		updaterState: updaterState,
		resync:       make(chan struct{}, 1),
		titles:       make(map[*systray.MenuItem]string),
	}

	// Subscribe before the updates start, so that no outcome is missed
	scheduler.Subscribe(t.onUpdate)

	onReady := func() {
		t.buildMenu()
		t.refresh(true)

		go t.refreshLoop()
		go func() {
			<-ctx.Done()
			systray.Quit()
		}()

		// Start the actual background tasks of the application
		go startApp()
	}

	onExit := func() {
		logging.Log.Info("System tray exited")
	}

	systray.Run(onReady, onExit)
}

// bind runs action on every click on the item, then redraws the menu.
func (t *tray) bind(item *systray.MenuItem, action func()) {
	go func() {
		for {
			select {
			case <-t.ctx.Done():
				return
			case <-item.ClickedCh:
				action()
				t.requestResync()
			}
		}
	}()
}

// run executes a tray action and logs its error.
func (t *tray) run(name string, action func() error) {
	if err := action(); err != nil {
		logging.Log.Error("tray action failed", zap.String("action", name), zap.Error(err))
	}
}

func (t *tray) requestResync() {
	select {
	case t.resync <- struct{}{}:
	default:
	}
}

func (t *tray) refreshLoop() {
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()

	for {
		force := false
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
		case <-t.resync:
			force = true
		}

		t.refresh(force)
	}
}

// refresh syncs the menu with the current state. It only touches items that changed, unless force is set:
// on Linux a click toggles a checkbox natively, so after a click the checkboxes have to be re-applied.
func (t *tray) refresh(force bool) {
	now := time.Now()
	s := t.snapshot()
	l := s.lang
	m := &t.menu

	t.setTitle(m.status, s.statusLine(now))
	t.setTitle(m.open, msgOpenDashboard.in(l))
	t.setTitle(m.copyLink, t.copyLinkTitle(l, now))
	t.setTitle(m.updateNow, msgUpdateNow.in(l))
	setEnabled(m.updateNow, !s.updating)

	t.setTitle(m.auto, s.autoUpdateTitle())
	for i, option := range pauseOptions {
		t.setTitle(m.pauses[i], option.title.in(l))
	}
	t.setTitle(m.pauseForever, msgPauseForever.in(l))
	t.setTitle(m.resume, msgResume.in(l))
	if s.paused != t.resumeShown || force {
		if s.paused {
			m.resume.Show()
		} else {
			m.resume.Hide()
		}
		t.resumeShown = s.paused
	}

	t.setTitle(m.interval, s.intervalTitle())
	for i, minutes := range intervalOptions {
		t.setTitle(m.intervals[i], formatInterval(l, minutes))
		setChecked(m.intervals[i], s.interval == minutes, force)
	}

	t.setTitle(m.check, s.checkLevelTitle())
	t.setTitle(m.fast, msgCheckFast.in(l))
	t.setTitle(m.deep, msgCheckDeep.in(l))
	setChecked(m.fast, s.level != config.WorkingCheckSingBox, force)
	setChecked(m.deep, s.level == config.WorkingCheckSingBox, force)

	t.setTitle(m.prefs, msgPreferences.in(l))
	t.setTitle(m.autoStart, msgStartWithSystem.in(l))
	setChecked(m.autoStart, s.autoStart, force)
	t.setTitle(m.notifications, msgNotifications.in(l))
	setChecked(m.notifications, s.notifications, force)
	t.setTitle(m.langAuto, msgLangAuto.in(l))
	setChecked(m.langAuto, s.language != config.LanguageRU && s.language != config.LanguageEN, force)
	t.setTitle(m.langRU, msgLangRU.in(l))
	setChecked(m.langRU, s.language == config.LanguageRU, force)
	t.setTitle(m.langEN, msgLangEN.in(l))
	setChecked(m.langEN, s.language == config.LanguageEN, force)

	t.setTitle(m.files, msgFiles.in(l))
	t.setTitle(m.fileConfig, msgFileConfig.in(l))
	t.setTitle(m.fileConfigs, configsFileTitle(l, t.configsFileName()))
	t.setTitle(m.fileLog, msgFileLog.in(l))

	title, enabled := s.appUpdateTitle()
	t.setTitle(m.appUpdate, title)
	setEnabled(m.appUpdate, enabled)
	t.notifyNewVersion(s)

	t.setTitle(m.quit, msgQuit.in(l))

	if kind := s.iconKind(); force || kind != t.icon {
		systray.SetIcon(iconData(kind))
		t.icon = kind
	}

	if tooltip := s.tooltip(now); tooltip != t.tooltip {
		systray.SetTooltip(tooltip)
		t.tooltip = tooltip
	}
}

func (t *tray) snapshot() snapshot {
	cfgSafe := t.cfg.RetrieveSafe(config.Language, config.AutoStart, config.Notifications, config.UpdateInterval)
	state := t.scheduler.State()
	amount, lastUpdate := t.statistics.Summary()
	updater := t.updaterState.Get()

	s := snapshot{
		lang:          resolveLanguage(cfgSafe.Language),
		paused:        state.Paused,
		forever:       state.Forever,
		level:         state.WorkingCheckLevel,
		interval:      cfgSafe.UpdateInterval,
		updating:      aggregator.UpdateInProgress(),
		failing:       t.scheduler.LastError() != nil,
		amount:        amount,
		autoStart:     cfgSafe.AutoStart,
		notifications: cfgSafe.Notifications,
		language:      cfgSafe.Language,
		update:        appUpdate{status: updater.Status, version: updater.Version, progress: updater.Progress},
		version:       t.statistics.AppVersion(),
	}
	if state.PausedUntil > 0 {
		s.until = time.Unix(state.PausedUntil, 0)
	}
	if lastUpdate > 0 {
		s.lastUpdate = time.Unix(lastUpdate, 0)
	}

	return s
}

func (t *tray) setTitle(item *systray.MenuItem, title string) {
	if t.titles[item] != title {
		item.SetTitle(title)
		t.titles[item] = title
	}
}

func setEnabled(item *systray.MenuItem, enabled bool) {
	if item.Disabled() == !enabled {
		return
	}

	if enabled {
		item.Enable()
	} else {
		item.Disable()
	}
}

func setChecked(item *systray.MenuItem, checked, force bool) {
	if !force && item.Checked() == checked {
		return
	}

	if checked {
		item.Check()
	} else {
		item.Uncheck()
	}
}

// flashCopy temporarily replaces the title of the copy item with a result message.
func (t *tray) flashCopy(message text) {
	t.flashMu.Lock()
	defer t.flashMu.Unlock()

	t.flashText = message
	t.flashUntil = time.Now().Add(flashDuration)
}

func (t *tray) copyLinkTitle(l lang, now time.Time) string {
	t.flashMu.Lock()
	defer t.flashMu.Unlock()

	if now.Before(t.flashUntil) {
		return t.flashText.in(l)
	}
	return msgCopyLink.in(l)
}
