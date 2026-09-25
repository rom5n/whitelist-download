//go:build !windows

package desktop

import "os/exec"

func hideWindow(*exec.Cmd) {}
