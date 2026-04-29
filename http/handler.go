package http

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rom5n/whitelist-download/domain"
)

func setHeaders(w http.ResponseWriter, title, description string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("profile-update-interval", "1")
	w.Header().Set("subscription-userinfo", "upload=0; download=0; total=0; expire=0")
	w.Header().Set("profile-title", fmt.Sprintf("base64:%v", title))
	w.Header().Set("announce", fmt.Sprintf("base64:%v", description))
	w.Header().Set("date", time.Now().UTC().Format(http.TimeFormat))
	w.Header().Set("routing-enable", "true")
}

func subscriptionHandler(configsPath string, configsCache *domain.SafeConfigsCache, subscriptionTitle, descriptionText string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		offset, limit, err := getLimitForConfigs(r)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(err.Error()))
			return
		}

		title := base64.StdEncoding.EncodeToString([]byte(subscriptionTitle))
		description := base64.StdEncoding.EncodeToString([]byte(descriptionText))

		setHeaders(w, title, description)

		encoder := base64.NewEncoder(base64.StdEncoding, w)
		defer encoder.Close()

		addedConfigs := getConfigsFromCache(configsCache, encoder, offset, limit)

		if addedConfigs == 0 {
			log.Printf("cache missed. Loading configs from file: %v\n", configsPath)
			configsFile := domain.GetFile(configsPath)
			defer configsFile.Close()
			addedConfigs = getConfigsFromFile(configsFile, encoder, offset, limit)
		}

		log.Printf("configs sent. Amount: %v. Offset: %v. limit: %v.\n", addedConfigs, offset, limit)
	}
}

func getConfigsFromCache(configsCache *domain.SafeConfigsCache, encoder io.WriteCloser, offset int, limit int) int {
	addedConfigs := 0

	for i, text := range configsCache.Get() {
		if i < offset-1 {
			continue
		}

		encoder.Write([]byte(text))
		encoder.Write([]byte("\n"))

		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}
	}

	return addedConfigs
}

func getConfigsFromFile(configsFile *domain.SafeFile, encoder io.WriteCloser, offset, limit int) int {
	addedConfigs := 0

	scan := bufio.NewScanner(configsFile)

	currentLine := 1
	for scan.Scan() {
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
		log.Println("failed to read config file", err)
	}

	return addedConfigs
}

func getLimitForConfigs(r *http.Request) (int, int, error) {
	path := strings.TrimPrefix(r.URL.Path, "/sub")
	path = strings.TrimPrefix(path, "/")

	limit := 0
	offset := 0

	if path != "" {
		var err error
		data := strings.Split(path, "-")

		limit, err = strconv.Atoi(data[0])
		if err != nil {
			log.Println("invalid limit for requested configs")
			return 0, 0, fmt.Errorf("invalid limit")
		}

		if len(data) == 2 {
			offset, err = strconv.Atoi(data[0])
			if err != nil {
				log.Println("invalid offset foe requested configs")
				return 0, 0, fmt.Errorf("invalid offset for requested configs")
			}

			limit, err = strconv.Atoi(data[1])
			if err != nil {
				log.Println("invalid limit for requested configs")
				return 0, 0, fmt.Errorf("invalid limit for requested configs")
			}
		}
	}

	if offset < 1 {
		offset = 1
	}

	return offset, limit, nil
}

func getSubscriptionLink(link string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write([]byte(link))
		return
	}
}

func getStatistic(statistic *domain.Statistic) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		err := json.NewEncoder(w).Encode(statistic)
		if err != nil {
			http.Error(w, "failed to get statistics", http.StatusInternalServerError)
			return
		}
	}
}
