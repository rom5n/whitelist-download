package tray

import (
	"context"
	"runtime"
	"syscall"
	"unsafe"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// The tray menu is a native Win32 popup menu, so its look is controlled through the OS:
//   - the colors follow the system app theme (light or dark) and switch as soon as the theme changes,
//     through the undocumented but stable uxtheme dark mode API used by Explorer and most tray apps;
//   - on Windows 11 the menu windows get the regular (larger) corner radius instead of the small one.

const personalizeKey = `Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`

// Ordinals of the undocumented uxtheme functions (Windows 10 1809+).
const (
	ordRefreshImmersiveColorPolicyState = 104
	ordAllowDarkModeForWindow           = 133
	ordSetPreferredAppMode              = 135 // AllowDarkModeForApp(bool) on 1809
	ordFlushMenuThemes                  = 136
)

// Values of SetPreferredAppMode.
const (
	appModeAllowDark  = 1
	appModeForceDark  = 2
	appModeForceLight = 3
)

const (
	buildDarkModeApp    = 17763 // Windows 10 1809: AllowDarkModeForApp
	buildPreferredMode  = 18362 // Windows 10 1903: SetPreferredAppMode
	buildRoundedCorners = 22000 // Windows 11

	dwmwaWindowCornerPreference = 33
	dwmwcpRound                 = 2

	eventSystemMenuPopupStart = 0x0006
	eventObjectCreate         = 0x8000
	eventObjectShow           = 0x8002
	objIDWindow               = 0
	wineventOutOfContext      = 0x0000
	wmQuit                    = 0x0012

	menuClassName = "#32768"
	trayClassName = "SystrayClass" // The hidden window of getlantern/systray that owns the menu
)

var (
	user32 = windows.NewLazySystemDLL("user32.dll")
	dwmapi = windows.NewLazySystemDLL("dwmapi.dll")

	procSetWinEventHook          = user32.NewProc("SetWinEventHook")
	procUnhookWinEvent           = user32.NewProc("UnhookWinEvent")
	procGetMessageW              = user32.NewProc("GetMessageW")
	procPostThreadMessageW       = user32.NewProc("PostThreadMessageW")
	procGetClassNameW            = user32.NewProc("GetClassNameW")
	procFindWindowExW            = user32.NewProc("FindWindowExW")
	procGetWindowThreadProcessID = user32.NewProc("GetWindowThreadProcessId")
	procDwmSetWindowAttribute    = dwmapi.NewProc("DwmSetWindowAttribute")
)

// uxtheme holds the dark mode functions; a zero address means the OS doesn't have it.
type uxtheme struct {
	build                  uint32
	refreshColorPolicy     uintptr
	allowDarkModeForWindow uintptr
	setPreferredAppMode    uintptr
	flushMenuThemes        uintptr
}

func loadUxtheme(build uint32) *uxtheme {
	ux := &uxtheme{build: build}
	if build < buildDarkModeApp {
		return ux
	}

	dll, err := windows.LoadLibraryEx("uxtheme.dll", 0, windows.LOAD_LIBRARY_SEARCH_SYSTEM32)
	if err != nil {
		logging.Log.Warn("failed to load uxtheme.dll, the tray menu keeps the default colors", zap.Error(err))
		return ux
	}

	proc := func(ordinal uintptr) uintptr {
		addr, err := windows.GetProcAddressByOrdinal(dll, ordinal)
		if err != nil {
			logging.Log.Warn("uxtheme function is missing", zap.Uint64("ordinal", uint64(ordinal)), zap.Error(err))
			return 0
		}
		return addr
	}
	ux.refreshColorPolicy = proc(ordRefreshImmersiveColorPolicyState)
	ux.allowDarkModeForWindow = proc(ordAllowDarkModeForWindow)
	ux.setPreferredAppMode = proc(ordSetPreferredAppMode)
	ux.flushMenuThemes = proc(ordFlushMenuThemes)
	return ux
}

// apply switches the menus of the process to the dark or light theme; the next opened menu uses it.
func (ux *uxtheme) apply(dark bool) {
	if ux.setPreferredAppMode == 0 {
		return
	}

	mode := uintptr(appModeForceLight)
	if dark {
		mode = appModeForceDark
	}
	if ux.build < buildPreferredMode {
		// On 1809 the same ordinal is AllowDarkModeForApp(BOOL): allow it and let the system decide
		mode = appModeAllowDark
	}
	syscall.SyscallN(ux.setPreferredAppMode, mode)

	if ux.allowDarkModeForWindow != 0 {
		if hwnd := findTrayWindow(); hwnd != 0 {
			syscall.SyscallN(ux.allowDarkModeForWindow, hwnd, boolArg(dark))
		}
	}
	if ux.refreshColorPolicy != 0 {
		syscall.SyscallN(ux.refreshColorPolicy)
	}
	if ux.flushMenuThemes != 0 {
		syscall.SyscallN(ux.flushMenuThemes)
	}
}

func boolArg(b bool) uintptr {
	if b {
		return 1
	}
	return 0
}

// findTrayWindow returns the hidden window of this process that owns the tray menu, or 0.
func findTrayWindow() uintptr {
	className, err := windows.UTF16PtrFromString(trayClassName)
	if err != nil {
		return 0
	}

	pid := windows.GetCurrentProcessId()
	var hwnd uintptr
	for {
		hwnd, _, _ = procFindWindowExW.Call(0, hwnd, uintptr(unsafe.Pointer(className)), 0)
		if hwnd == 0 {
			return 0
		}
		var owner uint32
		procGetWindowThreadProcessID.Call(hwnd, uintptr(unsafe.Pointer(&owner)))
		if owner == pid {
			return hwnd
		}
	}
}

// systemUsesDarkTheme reports whether apps should use the dark theme (Settings → Personalization → Colors).
func systemUsesDarkTheme(key registry.Key) bool {
	light, _, err := key.GetIntegerValue("AppsUseLightTheme")
	if err != nil {
		return false // Older systems have no dark theme
	}
	return light == 0
}

// watchNativeLook applies the menu theme and corner radius and keeps the theme in sync with the system
// until ctx is done. It must be called after the tray window is created (from onReady).
func watchNativeLook(ctx context.Context) {
	build := windowsBuild()
	ux := loadUxtheme(build)

	key, err := registry.OpenKey(registry.CURRENT_USER, personalizeKey, registry.QUERY_VALUE|registry.NOTIFY)
	if err != nil {
		logging.Log.Warn("failed to open the theme settings, the tray menu keeps the default colors", zap.Error(err))
	} else {
		dark := systemUsesDarkTheme(key)
		ux.apply(dark)
		go watchTheme(ctx, key, ux, dark)
	}

	if build >= buildRoundedCorners {
		go roundMenuCorners(ctx)
	}
}

func windowsBuild() uint32 {
	return windows.RtlGetVersion().BuildNumber
}

// watchTheme waits for changes of the theme settings and re-applies the menu theme when it changes.
func watchTheme(ctx context.Context, key registry.Key, ux *uxtheme, dark bool) {
	defer key.Close()

	event, err := windows.CreateEvent(nil, 0, 0, nil)
	if err != nil {
		logging.Log.Warn("failed to watch the system theme", zap.Error(err))
		return
	}
	defer windows.CloseHandle(event)

	for {
		// The notification is one-shot, so it is re-armed before every wait
		err = windows.RegNotifyChangeKeyValue(windows.Handle(key), false, windows.REG_NOTIFY_CHANGE_LAST_SET, event, true)
		if err != nil {
			logging.Log.Warn("failed to watch the system theme", zap.Error(err))
			return
		}

		for {
			result, err := windows.WaitForSingleObject(event, 1000)
			if ctx.Err() != nil {
				return
			}
			if err != nil {
				logging.Log.Warn("failed to watch the system theme", zap.Error(err))
				return
			}
			if result == windows.WAIT_OBJECT_0 {
				break
			}
		}

		if now := systemUsesDarkTheme(key); now != dark {
			dark = now
			ux.apply(dark)
			logging.Log.Debug("tray menu theme changed", zap.Bool("dark", dark))
		}
	}
}

// roundMenuCorners gives every popup menu of the process the regular Windows 11 corner radius
// (menus get the small one by default). The system resets the preference when a menu is shown, so it is
// applied again on show. WinEvent hooks need a message loop on their thread.
func roundMenuCorners(ctx context.Context) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	callback := syscall.NewCallback(func(hook, event, hwnd, idObject, idChild, thread, time uintptr) uintptr {
		if hwnd != 0 && (int32(idObject) == objIDWindow || event == eventSystemMenuPopupStart) && isMenuWindow(hwnd) {
			preference := uint32(dwmwcpRound)
			procDwmSetWindowAttribute.Call(hwnd, dwmwaWindowCornerPreference, uintptr(unsafe.Pointer(&preference)), unsafe.Sizeof(preference))
		}
		return 0
	})

	pid := uintptr(windows.GetCurrentProcessId())
	var hooks []uintptr
	for _, event := range []uintptr{eventObjectCreate, eventObjectShow, eventSystemMenuPopupStart} {
		hook, _, err := procSetWinEventHook.Call(event, event, 0, callback, pid, 0, wineventOutOfContext)
		if hook == 0 {
			logging.Log.Warn("failed to hook the tray menu", zap.Error(err))
			continue
		}
		hooks = append(hooks, hook)
	}
	if len(hooks) == 0 {
		return
	}
	defer func() {
		for _, hook := range hooks {
			procUnhookWinEvent.Call(hook)
		}
	}()

	threadID := windows.GetCurrentThreadId()
	go func() {
		<-ctx.Done()
		procPostThreadMessageW.Call(uintptr(threadID), wmQuit, 0, 0)
	}()

	// Out-of-context hooks are delivered while the thread waits for messages
	var msg [48]byte // MSG
	for {
		result, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg[0])), 0, 0, 0)
		if int32(result) <= 0 {
			return
		}
	}
}

func isMenuWindow(hwnd uintptr) bool {
	var name [16]uint16
	n, _, _ := procGetClassNameW.Call(hwnd, uintptr(unsafe.Pointer(&name[0])), uintptr(len(name)))
	return n > 0 && windows.UTF16ToString(name[:n]) == menuClassName
}
