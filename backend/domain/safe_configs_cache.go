package domain

import "sync"

type SafeConfigsCache struct {
	sync.RWMutex
	configs []string
}

func (c *SafeConfigsCache) Set(configs []string) {
	c.RWMutex.Lock()
	defer c.RWMutex.Unlock()

	newConfigs := make([]string, len(configs))
	copy(newConfigs, configs)
	c.configs = newConfigs
}

func (c *SafeConfigsCache) Get() []string {
	c.RWMutex.RLock()
	defer c.RWMutex.RUnlock()

	if c.configs == nil {
		return nil
	}

	result := make([]string, len(c.configs))
	copy(result, c.configs)
	return result
}
