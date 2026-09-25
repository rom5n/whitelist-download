package handler

import (
	"bufio"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

func setSubscriptionHeaders(w http.ResponseWriter, title, description string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("profile-update-interval", "1")
	w.Header().Set("subscription-userinfo", "upload=0; download=0; total=0; expire=0")
	w.Header().Set("profile-title", fmt.Sprintf("base64:%v", title))
	w.Header().Set("announce", fmt.Sprintf("base64:%v", description))
	w.Header().Set("date", time.Now().UTC().Format(http.TimeFormat))
	w.Header().Set("routing-enable", "true")
}

func Subscription(cfg *config.Config, configsCache *domain.SafeConfigsCache) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		cfgSafe := cfg.RetrieveSafe(config.SubscriptionTitle, config.DescriptionText)
		subscriptionTitle := cfgSafe.SubscriptionTitle
		descriptionText := cfgSafe.DescriptionText
		configsPath := config.ConfigsFilePath()

		offset, limit, country, err := retrieveParams(r)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(err.Error()))
			return
		}

		title := base64.StdEncoding.EncodeToString([]byte(subscriptionTitle))
		description := base64.StdEncoding.EncodeToString([]byte(descriptionText))

		setSubscriptionHeaders(w, title, description)

		encoder := base64.NewEncoder(base64.StdEncoding, w)
		defer encoder.Close()

		addedConfigs, err := sendConfigsFromCache(configsCache, encoder, offset, limit, country)
		if err != nil && errors.Is(err, errors.New("EOF")) {
			return
		}

		if addedConfigs == 0 {
			logging.Log.Debug("cache missed. Loading configs from file", zap.String("filename", configsPath))
			configsFile := domain.GetFile(configsPath)
			defer configsFile.Close()
			addedConfigs = sendConfigsFromFile(configsFile, encoder, offset, limit, country)
		}

		logging.Log.Debug("configs sent", zap.Int("amount", addedConfigs), zap.Int("offset", offset), zap.Int("limit", limit), zap.String("country", country))
	}
}

func sendConfigsFromCache(configsCache *domain.SafeConfigsCache, encoder io.WriteCloser, offset, limit int, country string) (int, error) {
	if country != "" {
		return configsWithCountry(configsCache, encoder, limit, offset, country)
	}

	return anyConfigs(configsCache, encoder, limit, offset)

}

func configsWithCountry(configsCache *domain.SafeConfigsCache, encoder io.WriteCloser, limit, offset int, country string) (int, error) {
	addedConfigs := 0
	skippedConfigs := 0
	configs := configsCache.Get()[country]
	for _, text := range configs {
		if skippedConfigs < offset-1 {
			skippedConfigs += 1
			continue
		}

		encoder.Write([]byte(text))
		encoder.Write([]byte("\n"))

		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}
	}
	if addedConfigs == 0 && skippedConfigs != 0 {
		return 0, errors.New("EOF")
	}
	return addedConfigs, nil
}

func anyConfigs(configsCache *domain.SafeConfigsCache, encoder io.WriteCloser, limit, offset int) (int, error) {
	addedConfigs := 0
	skippedConfigs := 0

	cacheMap := configsCache.Get()

	keys := make([]string, 0, len(cacheMap))
	for k := range cacheMap {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		configs := cacheMap[k]

		if limit > 0 && addedConfigs >= limit {
			break
		}

		for _, text := range configs {
			if skippedConfigs < offset-1 {
				skippedConfigs += 1
				continue
			}

			encoder.Write([]byte(text))
			encoder.Write([]byte("\n"))

			addedConfigs++

			if limit > 0 && addedConfigs >= limit {
				break
			}
		}
	}

	if addedConfigs == 0 && skippedConfigs != 0 {
		return 0, errors.New("EOF")
	}

	return addedConfigs, nil
}

func sendConfigsFromFile(configsFile *domain.SafeFile, encoder io.WriteCloser, offset, limit int, country string) int {
	addedConfigs := 0
	scan := bufio.NewScanner(configsFile)
	currentLine := 1

	for scan.Scan() {
		urlParts, err := url.Parse(scan.Text())
		if err != nil {
			logging.Log.Error("failed to parse config url while sending from file", zap.String("url", scan.Text()), zap.Error(err))
			continue
		}

		if country != "" {
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
		}

		if currentLine < offset {
			currentLine++
			continue
		}

		encoder.Write(scan.Bytes())
		encoder.Write([]byte("\n"))
		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}
		currentLine++
	}

	if err := scan.Err(); err != nil {
		logging.Log.Error("failed to read config file", zap.Error(err))
	}
	return addedConfigs
}
