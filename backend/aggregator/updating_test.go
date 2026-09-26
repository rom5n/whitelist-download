package aggregator

import "testing"

func TestUTLSFingerprint(t *testing.T) {
	tests := map[string]string{
		"":           "chrome",
		"chrome":     "chrome",
		" Firefox ":  "firefox",
		"randomized": "randomized",
		"unsafe":     "chrome",
		"qwerty":     "chrome",
	}
	for in, want := range tests {
		if got := uTLSFingerprint(in); got != want {
			t.Errorf("uTLSFingerprint(%q) = %q, want %q", in, got, want)
		}
	}
}
