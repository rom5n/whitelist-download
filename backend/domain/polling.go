package domain

// PollingState is a snapshot of the configs auto update controls (pause and working check level).
type PollingState struct {
	Paused            bool  `json:"paused"`
	Forever           bool  `json:"forever"`             // Paused until resumed manually
	PausedUntil       int64 `json:"paused_until"`        // Unix time when updates resume; 0 if not paused or paused forever
	WorkingCheckLevel int   `json:"working_check_level"` // 1 - ping test, 2 - sing-box core test
}
