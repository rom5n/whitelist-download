//go:build with_utls

package aggregator

import (
	"context"
	"testing"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// Needs uTLS compiled in: go test -tags with_utls ./aggregator/

func TestBuildVLESSOutboundUnknownFingerprint(t *testing.T) {
	links := []string{
		"vless://11111111-1111-1111-1111-111111111111@example.com:443?security=reality&sni=example.com&pbk=Z84J2IelR9ch3k8VtlVhhs5ycBUlXA7wHBWcBrjqnAw&sid=6ba85179e30d4fc2&fp=unsafe&type=tcp#a",
		"vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&sni=example.com&fp=unsafe&type=ws&path=%2F#b",
	}
	for _, link := range links {
		outbound, err := buildVLESSOutbound(link, "proxy")
		if err != nil {
			t.Fatalf("buildVLESSOutbound(%q): %v", link, err)
		}
		if err = validateOutbound(outbound); err != nil {
			t.Fatalf("validateOutbound(%q): %v", link, err)
		}
	}
}

func TestSingBoxCheckerSkipsInvalidConfigs(t *testing.T) {
	logging.Log = zap.NewNop()

	valid := "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&sni=example.com&fp=chrome#a"
	// A Reality public key that is not base64 fails outbound initialization.
	broken := "vless://11111111-1111-1111-1111-111111111111@example.com:443?security=reality&sni=example.com&pbk=%21%21&fp=chrome#b"

	checker, err := newSingBoxChecker(context.Background(), []string{valid, broken, "trojan://x@example.com:443"})
	if err != nil {
		t.Fatalf("newSingBoxChecker: %v", err)
	}
	defer checker.Close()

	if _, ok := checker.users[valid]; !ok {
		t.Error("valid config was not added to the checker")
	}
	if len(checker.users) != 1 {
		t.Errorf("checker has %d configs, want 1: %v", len(checker.users), checker.users)
	}
	if checker.check(context.Background(), broken) {
		t.Error("broken config reported as working")
	}
}
