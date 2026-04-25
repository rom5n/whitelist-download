package main

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/windows/registry"
)

const (
	AppName           = "WhitelistsDownload"
	SubscriptionTitle = "🌊 OpenSource VPN"
	DescriptionText   = "⚡ Subscriptions from open sources"
	port              = "55000"
	configs           = "configs.txt"
	logs              = "log.txt"

	subPath = "/sub"
)

var sources = []string{
	"https://raw.githubusercontent.com/zieng2/wl/main/vless_lite.txt",
	"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile.txt",
	"https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile-2.txt",
	"https://raw.githubusercontent.com/whoahaow/rjsxrd/refs/heads/main/githubmirror/bypass/bypass-all.txt",
}

type SafeFile struct {
	sync.RWMutex
	file *os.File
	Name string
}

func (f *SafeFile) Write(data []byte) (int, error) {
	f.RWMutex.Lock()
	defer f.RWMutex.Unlock()

	return f.file.Write(data)
}

func (f *SafeFile) Read(b []byte) (int, error) {
	f.RWMutex.RLock()
	defer f.RWMutex.RUnlock()

	return f.file.Read(b)
}

func (f *SafeFile) Truncate(i int64) error {
	f.RWMutex.Lock()
	defer f.RWMutex.Unlock()

	return f.file.Truncate(i)
}

func (f *SafeFile) Seek(offset int64, whence int) (int64, error) {
	f.RWMutex.Lock()
	defer f.RWMutex.Unlock()

	return f.file.Seek(offset, whence)
}

func (f *SafeFile) WriteString(s string) (int, error) {
	f.RWMutex.Lock()
	defer f.RWMutex.Unlock()

	return f.file.WriteString(s)
}

func addToStartup() {
	err := func() error {
		exePath, err := os.Executable()
		if err != nil {
			return fmt.Errorf("не удалось получить путь к исполняемому файлу: %w", err)
		}

		exePath, err = filepath.Abs(exePath)
		if err != nil {
			return fmt.Errorf("не удалось получить абсолютный путь: %w", err)
		}

		key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
		if err != nil {
			return fmt.Errorf("не удалось открыть ключ реестра: %w", err)
		}
		defer key.Close()

		err = key.SetStringValue(AppName, exePath)
		if err != nil {
			return fmt.Errorf("не удалось записать значение в реестр: %w", err)
		}

		return nil
	}()

	if err != nil {
		log.Printf("🚫 failed to add to startup: %v\n", err)
	} else {
		log.Println("✅ added to startup")
	}
}

func getLimitConfigs(r *http.Request) (int, int) {
	path := strings.TrimPrefix(r.URL.Path, "/sub")
	path = strings.TrimPrefix(path, "/")

	limit := 0
	offset := 0

	if path != "" {
		var err error
		data := strings.Split(path, "-")

		limit, err = strconv.Atoi(data[0])
		if err != nil {
			log.Println("⚠️ Invalid limit for requested configs")
		}

		if len(data) == 2 {
			offset, err = strconv.Atoi(data[0])
			limit, err = strconv.Atoi(data[1])

			if err != nil {
				log.Println("⚠️ Invalid offset or limit for requested configs")
			}
		}
	}

	if offset < 1 {
		offset = 1
	}

	return offset, limit
}

func subHandler(configsFile *SafeFile) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		offset, limit := getLimitConfigs(r)

		title := base64.StdEncoding.EncodeToString([]byte(SubscriptionTitle))
		description := base64.StdEncoding.EncodeToString([]byte(DescriptionText))

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("profile-update-interval", "1")
		w.Header().Set("subscription-userinfo", "upload=0; download=0; total=0; expire=0")
		w.Header().Set("profile-title", fmt.Sprintf("base64:%v", title))
		w.Header().Set("announce", fmt.Sprintf("base64:%v", description))
		w.Header().Set("date", time.Now().UTC().Format(http.TimeFormat))
		w.Header().Set("routing-enable", "true")

		configsFile.Seek(0, io.SeekStart)
		defer configsFile.Seek(0, io.SeekStart)

		scan := bufio.NewScanner(configsFile)
		var data string

		currentLine := 1
		addedConfigs := 0

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
			log.Println("⚠️ Ошибка при чтении файла конфигов:", err)
		}

		data = strings.TrimSpace(data)
		encoded := base64.StdEncoding.EncodeToString([]byte(data))

		w.Write([]byte(encoded))

		log.Printf("✅ Configs sent. Offset: %v, limit: %v\n", offset, limit)
	}
}

func getIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}

	var fallbackIP string

	for _, iface := range interfaces {
		// 1. Игнорируем выключенные интерфейсы и Loopback (127.0.0.1)
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		// 2. Игнорируем интерфейсы "точка-точка" (часто это классические VPN типа OpenVPN)
		if iface.Flags&net.FlagPointToPoint != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				ip := ipnet.IP.To4()
				if ip != nil {
					ipStr := ip.String()

					// 3. Отсекаем известные виртуальные подсети (TUN-режимы прокси)
					if strings.HasPrefix(ipStr, "198.18.") {
						continue
					}

					// 4. Ищем стандартный домашний IP-адрес роутера (самый частый вариант)
					if strings.HasPrefix(ipStr, "192.168.") {
						return ipStr // Нашли идеальный вариант! Сразу возвращаем.
					}

					// Сохраняем как запасной вариант (например, если роутер выдает 10.x.x.x)
					if ip.IsPrivate() {
						fallbackIP = ipStr
					}
				}
			}
		}
	}

	// Если не нашли 192.168.x.x, возвращаем другой приватный IP (если есть)
	if fallbackIP != "" {
		return fallbackIP
	}

	return "127.0.0.1" // Если совсем ничего не нашли
}

func startHttpSubscriptionServer(configsFile *SafeFile) {
	http.HandleFunc(subPath, subHandler(configsFile))
	http.HandleFunc(subPath+"/", subHandler(configsFile))

	log.Printf("⚡ Subscription server started on port: %v\n", port)
	log.Printf("✨✨ Check it: %v\n", "http://"+getIP()+":"+port+subPath+"/15")

	err := http.ListenAndServe("0.0.0.0:"+port, nil)
	if err != nil {
		log.Fatal("🚫 error while starting subscription server: ", err)
	}
}

func updateConfigs(configsFile *SafeFile) (errNum int) {
	for _, source := range sources {
		resp, err := http.Get(source)
		if err != nil {
			log.Println("🚫 error while downloading configs from source:", source, "error:", err)
			errNum++
		}

		scan := bufio.NewScanner(resp.Body)

		for scan.Scan() {
			text := scan.Text()
			if strings.HasPrefix(text, "vless://") {
				configsFile.WriteString(scan.Text())
				configsFile.WriteString("\n")
			}
		}

		resp.Body.Close()
	}

	return errNum
}

func ResetFile(file *SafeFile, name string) {
	if err := file.Truncate(0); err != nil {
		log.Println("🚫 failed to truncate file:", name, "error:", err)
	}

	if _, err := file.Seek(0, 0); err != nil {
		log.Println("🚫 failed to seek file:", name, "error:", err)
	}
}

func getFile(filename string) *SafeFile {
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_RDWR|os.O_TRUNC, 0666)
	if err != nil {
		log.Fatalf("🚫 error opening %v file: %v\n", filename, err)
	}

	return &SafeFile{file: file, Name: filename}
}

func configureLogging() {
	logFile := getFile(logs)

	log.SetOutput(logFile.file)

	// Clear all old logs
	ResetFile(logFile, logs)
}

func startPollingSubscriptions(configsFile *SafeFile) {
	for {
		ResetFile(configsFile, configs)

		if errNum := updateConfigs(configsFile); errNum == len(configs) {
			log.Println("⚠️ Too many errors, trying again...")
			continue
		}

		log.Printf("✅ %v updated\n", configs)

		time.Sleep(1 * time.Hour)
	}
}

func main() {
	configsFile := getFile(configs)

	configureLogging()

	addToStartup()

	go startPollingSubscriptions(configsFile)

	startHttpSubscriptionServer(configsFile)
}
