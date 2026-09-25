//go:build !windows

package desktop

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// run executes the command and waits for it, but not longer than commandTimeout.
func run(name string, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)

	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %w: %s", name, err, strings.TrimSpace(string(out)))
	}
	return nil
}
