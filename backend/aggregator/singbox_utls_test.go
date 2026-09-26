//go:build with_utls

package aggregator

import (
	"context"
	"testing"

	box "github.com/sagernet/sing-box"
	"github.com/sagernet/sing-box/include"
)

// Needs uTLS compiled in: go test -tags with_utls ./aggregator/
func TestBuildSingBoxOptionsUnknownFingerprint(t *testing.T) {
	links := []string{
		"vless://11111111-1111-1111-1111-111111111111@example.com:443?security=reality&sni=example.com&pbk=Z84J2IelR9ch3k8VtlVhhs5ycBUlXA7wHBWcBrjqnAw&sid=6ba85179e30d4fc2&fp=unsafe&type=tcp#a",
		"vless://11111111-1111-1111-1111-111111111111@example.com:443?security=tls&sni=example.com&fp=unsafe&type=ws&path=%2F#b",
	}
	for i, link := range links {
		opts, err := buildSingBoxOptions(link, 21000+i)
		if err != nil {
			t.Fatalf("buildSingBoxOptions(%q): %v", link, err)
		}
		instance, err := box.New(box.Options{Context: include.Context(context.Background()), Options: opts})
		if err != nil {
			t.Fatalf("box.New for %q: %v", link, err)
		}
		if err := instance.Close(); err != nil {
			t.Errorf("close: %v", err)
		}
	}
}
