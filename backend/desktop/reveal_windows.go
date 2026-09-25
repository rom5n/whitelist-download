package desktop

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func reveal(path string) error {
	// explorer parses its own command line: /select, needs the path in quotes, which Go's argument quoting can't produce.
	cmdLine := fmt.Sprintf(`explorer.exe "%s"`, filepath.Dir(path))
	if _, err := os.Stat(path); err == nil {
		cmdLine = fmt.Sprintf(`explorer.exe /select,"%s"`, path)
	}

	cmd := exec.Command("explorer.exe")
	cmd.SysProcAttr = &syscall.SysProcAttr{CmdLine: cmdLine}

	// explorer.exe reports exit code 1 even on success, so only starting it can fail.
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() { _ = cmd.Wait() }()

	return nil
}
