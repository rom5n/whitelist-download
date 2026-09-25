package handler

import "testing"

func TestResolveCountry(t *testing.T) {
	cache := map[string][]string{
		"Bosnia and Herzegovina": {"vless://a"},
		"United States":          {"vless://b"},
	}

	cases := map[string]string{
		"":                       "",
		"United States":          "United States",
		"united-states":          "United States",
		"bosnia-and-herzegovina": "Bosnia and Herzegovina",
		"Bosnia And Herzegovina": "Bosnia and Herzegovina",
		"germany":                "Germany",
	}
	for in, want := range cases {
		if got := resolveCountry(in, cache); got != want {
			t.Errorf("resolveCountry(%q) = %q, want %q", in, got, want)
		}
	}
}
