package domain

import "sync"

type UpdaterState struct {
	Status      string `json:"status"` // "checking", "available", "downloading", "up-to-date", "error"
	Version     string `json:"version"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Error       string `json:"error"`
	Progress    int    `json:"progress"` // 0-100
}

type SafeUpdaterState struct {
	sync.RWMutex
	state UpdaterState
}

func (s *SafeUpdaterState) Get() UpdaterState {
	s.RLock()
	defer s.RUnlock()
	return s.state
}

func (s *SafeUpdaterState) SetStatus(status string) {
	s.Lock()
	defer s.Unlock()
	s.state.Status = status
	s.state.Error = ""
}

func (s *SafeUpdaterState) SetError(err string) {
	s.Lock()
	defer s.Unlock()
	s.state.Status = "error"
	s.state.Error = err
}

func (s *SafeUpdaterState) SetProgress(progress int) {
	s.Lock()
	defer s.Unlock()
	s.state.Progress = progress
}

func (s *SafeUpdaterState) SetAvailable(version, title, description string) {
	s.Lock()
	defer s.Unlock()
	s.state.Status = "available"
	s.state.Version = version
	s.state.Title = title
	s.state.Description = description
	s.state.Error = ""
}
