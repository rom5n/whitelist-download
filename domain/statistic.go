package domain

import "sync"

type Statistic struct {
	sync.RWMutex
	AmountConfigs    int            `json:"amount_configs"`
	ConfigsByCountry map[string]int `json:"configs_by_country"`
	LastUpdate       int64          `json:"last_update"`
	StartedAt        int64          `json:"up_at"`
}

func (v *Statistic) Set(new *Statistic) {
	v.Lock()
	defer v.Unlock()
	v.LastUpdate = new.LastUpdate
	v.AmountConfigs = new.AmountConfigs
	v.ConfigsByCountry = new.ConfigsByCountry
	v.StartedAt = new.StartedAt
}
