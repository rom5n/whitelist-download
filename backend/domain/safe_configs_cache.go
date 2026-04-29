package domain

import "sync"

type SafeConfigsCache struct {
	sync.RWMutex
	configs []string
}

func (c *SafeConfigsCache) Set(configs []string) {
	c.RWMutex.Lock()
	defer c.RWMutex.Unlock()
	c.configs = configs
}

func (c *SafeConfigsCache) Get() []string {
	c.RWMutex.RLock()
	defer c.RWMutex.RUnlock()
	return c.configs
}
