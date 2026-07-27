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

func (v *Statistics) Set(new *Statistics) {
	v.Lock()
	defer v.Unlock()
	v.LastUpdate = new.LastUpdate
	v.AmountConfigs = new.AmountConfigs
	v.ConfigsByCountry = new.ConfigsByCountry
}
