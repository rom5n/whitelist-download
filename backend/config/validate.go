package config

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var ErrInvalidConfig = errors.New("invalid config")

// subscriptionPathPattern matches paths like /sub or /my/sub: no trailing slash, no spaces or special characters.
var subscriptionPathPattern = regexp.MustCompile(`^/[A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)*$`)

// reservedPaths are the first path segments taken by the dashboard, so the subscription can't use them.
var reservedPaths = map[string]bool{"api": true, "assets": true}

func invalid(field, message string) error {
	return fmt.Errorf("%w: %s %s", ErrInvalidConfig, field, message)
}

// Validate checks settings received from the dashboard. The settings are saved as they change,
// so incomplete or broken values (an empty port, a path without a slash) must never reach config.json:
// the server could not start with them. The message names the JSON key of the invalid field.
func Validate(cfg *Config) error {
	if strings.TrimSpace(cfg.AppName) == "" || strings.ContainsAny(cfg.AppName, `/\`) {
		return invalid("app_name", "must not be empty or contain slashes")
	}

	port, err := strconv.Atoi(cfg.Port)
	if err != nil || port < 1 || port > 65535 {
		return invalid("port", "must be a number from 1 to 65535")
	}

	if !subscriptionPathPattern.MatchString(cfg.SubscriptionPath) {
		return invalid("subscription_path", "must look like /sub: start with a slash, no trailing slash, only letters, digits and . _ ~ -")
	}
	if first, _, _ := strings.Cut(cfg.SubscriptionPath[1:], "/"); reservedPaths[first] {
		return invalid("subscription_path", "is reserved by the dashboard")
	}

	if strings.TrimSpace(cfg.ConfigsPath) == "" {
		return invalid("configs_path", "must not be empty")
	}

	if cfg.UpdateInterval < 1 || cfg.UpdateInterval > MaxUpdateInterval {
		return invalid("update_interval_minutes", fmt.Sprintf("must be from 1 to %d", MaxUpdateInterval))
	}

	if cfg.WorkingCheckLevel != WorkingCheckPing && cfg.WorkingCheckLevel != WorkingCheckSingBox {
		return invalid("working_check_level", "must be 1 or 2")
	}

	if strings.ContainsAny(cfg.ForcedIP, " \t\r\n/") {
		return invalid("forced_ip", "must be an IP address or a host name")
	}

	for _, source := range cfg.Sources {
		parsed, err := url.Parse(source)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return invalid("sources", fmt.Sprintf("contains an invalid URL: %q", source))
		}
	}

	return nil
}

// startedWith are the settings the running app was started with.
type startedWith struct {
	captured         bool
	appName          string
	port             string
	subscriptionPath string
}

// MarkStarted records the settings that only take effect on start, to tell later which changes await a restart.
func (config *Config) MarkStarted() {
	config.Lock()
	defer config.Unlock()

	config.started = startedWith{captured: true, appName: config.AppName, port: config.Port, subscriptionPath: config.SubscriptionPath}
}

// PendingRestart returns the JSON keys of the settings that were changed after the start and
// only take effect after a restart.
func (config *Config) PendingRestart() []string {
	config.RLock()
	defer config.RUnlock()

	if !config.started.captured {
		return nil
	}

	var pending []string
	if config.AppName != config.started.appName {
		pending = append(pending, "app_name")
	}
	if config.Port != config.started.port {
		pending = append(pending, "port")
	}
	if config.SubscriptionPath != config.started.subscriptionPath {
		pending = append(pending, "subscription_path")
	}

	return pending
}
