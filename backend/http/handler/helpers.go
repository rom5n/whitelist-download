package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/rom5n/whitelist-download/backend/logging"
	"github.com/rom5n/whitelist-download/backend/paths"
	"go.uber.org/zap"
)

func resolveConfigsPath(configsPath string) string {
	dataFilePath, err := paths.ResolveDataFile(configsPath)
	if err != nil {
		logging.Log.Warn("failed to resolve configs path", zap.Error(err))
	}
	return dataFilePath
}

func retrieveParams(r *http.Request) (int, int, string, error) {
	path := strings.TrimPrefix(r.URL.Path, "/sub")
	path = strings.TrimPrefix(path, "/")

	limit := 0
	offset := 0
	country := ""

	if path != "" {
		parts := strings.Split(path, "/")
		if len(parts) > 1 {
			country = parseCountryName(parts[0])
			data := strings.Split(parts[1], "-")
			var err error
			if len(data) == 2 {
				offset, err = strconv.Atoi(data[0])
				if err == nil {
					limit, err = strconv.Atoi(data[1])
				}
			} else {
				limit, err = strconv.Atoi(data[0])
			}
			if err != nil {
				return 0, 0, "", fmt.Errorf("invalid offset or limit")
			}
		} else {
			data := strings.Split(parts[0], "-")
			isNumber := false
			if len(data) > 0 {
				_, err := strconv.Atoi(data[0])
				if err == nil {
					isNumber = true
				}
			}

			if isNumber {
				var err error
				if len(data) == 2 {
					offset, err = strconv.Atoi(data[0])
					if err == nil {
						limit, err = strconv.Atoi(data[1])
					}
				} else {
					limit, err = strconv.Atoi(data[0])
				}
				if err != nil {
					return 0, 0, "", fmt.Errorf("invalid offset or limit")
				}
			} else {
				country = parseCountryName(parts[0])
			}
		}
	}

	if offset < 1 {
		offset = 1
	}

	return offset, limit, country, nil
}

func parseCountryName(country string) string {
	countryParts := strings.Split(country, "-")
	if len(countryParts) > 1 {
		for i, part := range countryParts {
			countryParts[i] = capitalize(part)
		}
		return strings.Join(countryParts, " ")
	}
	return capitalize(country)
}

func capitalize(s string) string {
	if s == "" {
		return ""
	}

	r, size := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[size:]
}
