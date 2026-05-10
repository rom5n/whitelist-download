package geo_ip

import (
	_ "embed"
	"log"
	"net"
	"strings"

	"github.com/oschwald/geoip2-golang"
)

const (
	geoliteFile = "geolite_temp.mmdb"
)

//go:embed geolite.mmdb
var geoliteData []byte

type Locator struct {
	db *geoip2.Reader
}

func InitLocator() *Locator {
	db, err := geoip2.FromBytes(geoliteData)
	if err != nil {
		log.Fatalf("failed to open GeoIP database: %v", err)
	}

	return &Locator{db: db}
}

func (l *Locator) Close() {
	if l.db != nil {
		l.db.Close()
	}
}

func (l *Locator) GetCountryNameAndFlag(address string) (string, string) {
	ips, err := net.LookupIP(address)
	if err != nil || len(ips) == 0 {
		return "Unknown", "❓"
	}

	ip := ips[0]

	record, err := l.db.Country(ip)
	if err != nil || record.Country.IsoCode == "" {
		return "Unknown", "❓"
	}

	isoCode := record.Country.IsoCode
	countryName := record.Country.Names["en"]

	return countryName, getEmojiFlag(isoCode)
}

func getEmojiFlag(isoCode string) string {
	if len(isoCode) != 2 {
		return "❓"
	}
	isoCode = strings.ToUpper(isoCode)

	flag := string(rune(isoCode[0])+127397) + string(rune(isoCode[1])+127397)
	return flag
}
