package tray

import "golang.org/x/sys/windows"

const primaryLangRussian = 0x19

var procGetUserDefaultUILanguage = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetUserDefaultUILanguage")

// detectSystemLanguage returns the Windows display language.
func detectSystemLanguage() lang {
	langID, _, _ := procGetUserDefaultUILanguage.Call()
	if langID&0x3ff == primaryLangRussian {
		return langRU
	}
	return langEN
}
