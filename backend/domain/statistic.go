package domain

import "sync"

type Statistics struct {
	sync.RWMutex
	AmountConfigs    int            `json:"amount_configs"`
	ConfigsByCountry map[string]int `json:"configs_by_country"`
	LastUpdate       int64          `json:"last_update"`
	StartedAt        int64          `json:"up_at"`
	UpdateInterval   int            `json:"update_interval"`
	Version          string         `json:"version"`
}

// Summary returns the amount of configs and the last update time (Unix seconds).
func (v *Statistics) Summary() (amountConfigs int, lastUpdate int64) {
	v.RLock()
	defer v.RUnlock()
	return v.AmountConfigs, v.LastUpdate
}

// AppVersion returns the app version.
func (v *Statistics) AppVersion() string {
	v.RLock()
	defer v.RUnlock()
	return v.Version
}

// SetUpdateInterval changes the configs update interval (in minutes) shown on the dashboard.
func (v *Statistics) SetUpdateInterval(minutes int) {
	v.Lock()
	defer v.Unlock()
	v.UpdateInterval = minutes
}

func (v *Statistics) Set(new *Statistics) {
	v.Lock()
	defer v.Unlock()
	v.LastUpdate = new.LastUpdate
	v.AmountConfigs = new.AmountConfigs
	v.ConfigsByCountry = new.ConfigsByCountry
}
