package handler

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

type ConfigsResponse struct {
	Configs []string `json:"configs"`
}

func Configs(cfg *config.Config, configsCache *domain.SafeConfigsCache) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		query := r.URL.Query()

		limit := 0
		if l := query.Get("limit"); l != "" {
			limit, _ = strconv.Atoi(l)
		}

		offset := 1
		if o := query.Get("offset"); o != "" {
			offset, _ = strconv.Atoi(o)
		}
		if offset < 1 {
			offset = 1
		}

		configsPath := config.ConfigsFilePath()

		var configs []string

		// Try from cache first
		cacheMap := configsCache.Get()
		country := resolveCountry(query.Get("country"), cacheMap)
		if len(cacheMap) > 0 {
			configs = extractConfigsFromMap(cacheMap, country, offset, limit)
		} else {
			// Cache missed, load from file
			logging.Log.Debug("cache missed. Loading configs from file", zap.String("filename", configsPath))
			configsFile := domain.GetFile(configsPath)
			if configsFile != nil {
				defer configsFile.Close()
				configs = extractConfigsFromFile(configsFile, country, offset, limit)
			}
		}

		if configs == nil {
			configs = []string{}
		}

		resp := ConfigsResponse{Configs: configs}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logging.Log.Error("failed to encode getConfigs response", zap.Error(err))
		}

		logging.Log.Debug("configs sent to frontend", zap.Int("amount", len(configs)), zap.Int("offset", offset), zap.Int("limit", limit), zap.String("country", country))
	}
}

func extractConfigsFromMap(cacheMap map[string][]string, country string, offset, limit int) []string {
	var results []string
	skipped := 0

	if country != "" {
		for _, text := range cacheMap[country] {
			if skipped < offset-1 {
				skipped++
				continue
			}
			results = append(results, text)
			if limit > 0 && len(results) >= limit {
				break
			}
		}
		return results
	}

	keys := make([]string, 0, len(cacheMap))
	for k := range cacheMap {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		configs := cacheMap[k]
		for _, text := range configs {
			if skipped < offset-1 {
				skipped++
				continue
			}
			results = append(results, text)
			if limit > 0 && len(results) >= limit {
				return results
			}
		}
	}

	return results
}

func extractConfigsFromFile(configsFile *domain.SafeFile, country string, offset, limit int) []string {
	var results []string
	scan := bufio.NewScanner(configsFile)
	currentLine := 1

	for scan.Scan() {
		text := scan.Text()
		if country != "" {
			urlParts, err := url.Parse(text)
			if err == nil {
				fragment := urlParts.Fragment
				firstSpace := strings.Index(fragment, " ")
				dashIndex := strings.Index(fragment, " — ")
				if firstSpace != -1 && dashIndex != -1 && dashIndex > firstSpace {
					configCountry := fragment[firstSpace+1 : dashIndex]
					if configCountry != country {
						continue
					}
				} else {
					continue
				}
			} else {
				continue
			}
		}

		if currentLine < offset {
			currentLine++
			continue
		}

		results = append(results, text)

		if limit > 0 && len(results) >= limit {
			break
		}
		currentLine++
	}

	if err := scan.Err(); err != nil {
		logging.Log.Error("failed to read config file", zap.Error(err))
	}
	return results
}
