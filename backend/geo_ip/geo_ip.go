package geo_ip

import (
	_ "embed"
	"net"
	"os"
	"strings"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"

	"github.com/oschwald/geoip2-golang"
)

//go:embed geoip.mmdb
var geoipData []byte

type Locator struct {
	db *geoip2.Reader
}

func InitLocator() *Locator {
	db, err := geoip2.FromBytes(geoipData)
	if err != nil {
		logging.Log.Error("failed to open GeoIP database", zap.Error(err))
		os.Exit(1)
	}

	return &Locator{db: db}
}

func (l *Locator) Close() {
	if l.db != nil {
		l.db.Close()
	}
}

// Country describes the location of a server
type Country struct {
	Name string // English country name, "Unknown" if not resolved
	Code string // ISO 3166-1 alpha-2 code, empty if not resolved
	Flag string // Emoji flag, used in config names
}

var unknownCountry = Country{Name: "Unknown", Flag: "❓"}

// Lookup resolves the country of a host name or IP address
func (l *Locator) Lookup(address string) Country {
	ips, err := net.LookupIP(address)
	if err != nil || len(ips) == 0 {
		return unknownCountry
	}

	record, err := l.db.Country(ips[0])
	if err != nil || record.Country.IsoCode == "" {
		return unknownCountry
	}

	isoCode := strings.ToUpper(record.Country.IsoCode)
	return Country{
		Name: record.Country.Names["en"],
		Code: isoCode,
		Flag: getEmojiFlag(isoCode),
	}
}

func getEmojiFlag(isoCode string) string {
	if len(isoCode) != 2 {
		return "❓"
	}
	isoCode = strings.ToUpper(isoCode)

	flag := string(rune(isoCode[0])+127397) + string(rune(isoCode[1])+127397)
	return flag
}
