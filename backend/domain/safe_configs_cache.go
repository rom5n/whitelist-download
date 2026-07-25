package domain

import (
	"maps"
	"sync"
)

type SafeConfigsCache struct {
	sync.RWMutex
	configs map[string][]string // Key: country, value: configs list
}

func (c *SafeConfigsCache) Set(configs map[string][]string) {
	c.RWMutex.Lock()
	defer c.RWMutex.Unlock()

	c.configs = maps.Clone(configs)
}

func (c *SafeConfigsCache) Get() map[string][]string {
	c.RWMutex.RLock()
	defer c.RWMutex.RUnlock()

	if c.configs == nil {
		return nil
	}

	return maps.Clone(c.configs)
}
