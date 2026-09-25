//go:build windows

package tray

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"syscall"
	"unsafe"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// The tray menu is a native Win32 popup menu (TrackPopupMenu), so its look is controlled through the OS:
//   - uxtheme's preferred app mode makes menus follow the system light/dark theme;
//   - DWM's corner preference gives the menu window rounded corners on Windows 11.

const (
	// Undocumented uxtheme.dll exports, available since Windows 10 1903 (build 18362)
	ordinalRefreshImmersiveColorPolicyState = 104
	ordinalSetPreferredAppMode              = 135
	ordinalFlushMenuThemes                  = 136
	appModeAllowDark                        = 1 // follow the system "apps use dark theme" setting
	minBuildForAppMode                      = 18362

	eventSystemMenuPopupStart = 0x0006
	wineventOutOfContext      = 0x0000

	dwmwaWindowCornerPreference = 33
	dwmwcpRound                 = 2 // DWMWCP_ROUND. Menus use DWMWCP_ROUNDSMALL by default

	personalizeKeyPath = `Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`
)

var (
	user32                    = windows.NewLazySystemDLL("user32.dll")
	dwmapi                    = windows.NewLazySystemDLL("dwmapi.dll")
	procSetWinEventHook       = user32.NewProc("SetWinEventHook")
	procUnhookWinEvent        = user32.NewProc("UnhookWinEvent")
	procGetMessageW           = user32.NewProc("GetMessageW")
	procTranslateMessage      = user32.NewProc("TranslateMessage")
	procDispatchMessageW      = user32.NewProc("DispatchMessageW")
	procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
)

type uxthemeProcs struct {
	refreshColorPolicy uintptr
	setPreferredMode   uintptr
	flushMenuThemes    uintptr
}

// setupNativeMenu must be called before the tray menu is created
func setupNativeMenu(ctx context.Context) {
	procs, err := loadUxthemeProcs()
	if err != nil {
		logging.Log.Warn("system theme for tray menu is unavailable", zap.Error(err))
	} else {
		syscall.SyscallN(procs.setPreferredMode, appModeAllowDark)
		syscall.SyscallN(procs.flushMenuThemes)
		go watchSystemTheme(ctx, procs)
	}

	go roundMenuCorners(ctx)
}

func loadUxthemeProcs() (*uxthemeProcs, error) {
	if windows.RtlGetVersion().BuildNumber < minBuildForAppMode {
		return nil, fmt.Errorf("windows build is older than %d", minBuildForAppMode)
	}

	uxtheme, err := windows.LoadLibraryEx("uxtheme.dll", 0, windows.LOAD_LIBRARY_SEARCH_SYSTEM32)
	if err != nil {
		return nil, fmt.Errorf("load uxtheme.dll: %w", err)
	}

	var procs uxthemeProcs
	ordinals := []struct {
		target  *uintptr
		ordinal uintptr
	}{
		{&procs.refreshColorPolicy, ordinalRefreshImmersiveColorPolicyState},
		{&procs.setPreferredMode, ordinalSetPreferredAppMode},
		{&procs.flushMenuThemes, ordinalFlushMenuThemes},
	}
	for _, o := range ordinals {
		proc, err := windows.GetProcAddressByOrdinal(uxtheme, o.ordinal)
		if err != nil {
			return nil, fmt.Errorf("uxtheme ordinal %d: %w", o.ordinal, err)
		}
		*o.target = proc
	}

	return &procs, nil
}

// watchSystemTheme re-themes menus as soon as the user switches the system theme, no restart needed
func watchSystemTheme(ctx context.Context, procs *uxthemeProcs) {
	key, err := registry.OpenKey(registry.CURRENT_USER, personalizeKeyPath, registry.NOTIFY|registry.QUERY_VALUE)
	if err != nil {
		logging.Log.Warn("failed to watch system theme", zap.Error(err))
		return
	}
	defer key.Close()

	for ctx.Err() == nil {
		// Blocks until a value of the key changes
		if err := windows.RegNotifyChangeKeyValue(windows.Handle(key), false, windows.REG_NOTIFY_CHANGE_LAST_SET, 0, false); err != nil {
			logging.Log.Warn("stopped watching system theme", zap.Error(err))
			return
		}
		syscall.SyscallN(procs.refreshColorPolicy)
		syscall.SyscallN(procs.flushMenuThemes)
	}
}

// roundMenuCorners listens for popup menus of this process and asks DWM for larger rounded corners.
// On Windows 10 DWM ignores the attribute, and the menu keeps its square corners.
func roundMenuCorners(ctx context.Context) {
	// WinEvent callbacks are delivered to the hooking thread through its message queue
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	callback := syscall.NewCallback(func(hook, event, hwnd, idObject, idChild, idThread, eventTime uintptr) uintptr {
		if hwnd == 0 {
			return 0
		}
		preference := uint32(dwmwcpRound)
		procDwmSetWindowAttribute.Call(hwnd, dwmwaWindowCornerPreference, uintptr(unsafe.Pointer(&preference)), unsafe.Sizeof(preference))
		return 0
	})

	hook, _, err := procSetWinEventHook.Call(
		eventSystemMenuPopupStart, eventSystemMenuPopupStart,
		0, callback,
		uintptr(os.Getpid()), 0,
		wineventOutOfContext,
	)
	if hook == 0 {
		logging.Log.Warn("failed to hook tray menu popups", zap.Error(err))
		return
	}
	defer procUnhookWinEvent.Call(hook)

	var msg struct {
		hwnd    uintptr
		message uint32
		wParam  uintptr
		lParam  uintptr
		time    uint32
		pt      struct{ x, y int32 }
	}
	for ctx.Err() == nil {
		ret, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			return
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
	}
}
