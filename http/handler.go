package http

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rom5n/whitelist-download/domain"
)

func setHeaders(w http.ResponseWriter, title, description string) http.ResponseWriter {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("profile-update-interval", "1")
	w.Header().Set("subscription-userinfo", "upload=0; download=0; total=0; expire=0")
	w.Header().Set("profile-title", fmt.Sprintf("base64:%v", title))
	w.Header().Set("announce", fmt.Sprintf("base64:%v", description))
	w.Header().Set("date", time.Now().UTC().Format(http.TimeFormat))
	w.Header().Set("routing-enable", "true")

	return w
}

func subscriptionHandler(configsFile *domain.SafeFile, configsCache *domain.SafeConfigsCache, subscriptionTitle, descriptionText string) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		offset, limit := getLimitForConfigs(r)

		title := base64.StdEncoding.EncodeToString([]byte(subscriptionTitle))
		description := base64.StdEncoding.EncodeToString([]byte(descriptionText))

		w = setHeaders(w, title, description)

		data, addedConfigs := getConfigsFromCache(configsCache, offset, limit)

		if data == "" {
			log.Printf("cache missed. Loading configs from file: %v\n", configsFile.Name)
			data, addedConfigs = getConfigsFromFile(configsFile, offset, limit)
		}

		data = strings.TrimSpace(data)
		encoded := base64.StdEncoding.EncodeToString([]byte(data))

		w.Write([]byte(encoded))

		log.Printf("configs sent. Amount: %v. Offset: %v. limit: %v.\n", addedConfigs, offset, limit)
	}
}

func getConfigsFromCache(configsCache *domain.SafeConfigsCache, offset int, limit int) (string, int) {
	var data string
	addedConfigs := 0

	for i, text := range configsCache.Get() {
		if i < offset {
			continue
		}

		data += text
		data += "\n"
		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}
	}

	return data, addedConfigs
}

func getConfigsFromFile(configsFile *domain.SafeFile, offset, limit int) (string, int) {
	var data string
	addedConfigs := 0

	configsFile.Seek(0, io.SeekStart)
	defer configsFile.Seek(0, io.SeekStart)

	scan := bufio.NewScanner(configsFile)

	currentLine := 1
	for scan.Scan() {
		if currentLine < offset {
			currentLine++
			continue
		}

		data += scan.Text()
		data += "\n"
		addedConfigs++

		if limit > 0 && addedConfigs >= limit {
			break
		}

		currentLine++
	}

	if err := scan.Err(); err != nil {
		log.Println("failed to read config file", err)
	}

	return data, addedConfigs
}

func getLimitForConfigs(r *http.Request) (int, int) {
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
		}

		if len(data) == 2 {
			offset, err = strconv.Atoi(data[0])
			limit, err = strconv.Atoi(data[1])

			if err != nil {
				log.Println("invalid offset or limit for requested configs")
			}
		}
	}

	if offset < 1 {
		offset = 1
	}

	return offset, limit
}
