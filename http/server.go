package http

import (
	"embed"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/rom5n/whitelist-download/domain"
)

//go:embed dist/
var static embed.FS

func Start(configsPath string, configsCache *domain.SafeConfigsCache, statistic *domain.Statistic, subPath, port, subscriptionTitle, descriptionText string) {
	ip := getIP()
	subLink := "http://" + ip + ":" + port + subPath + "/15"
	webLink := "http://" + ip + ":" + port + "/"

	http.HandleFunc(subPath, subscriptionHandler(configsPath, configsCache, subscriptionTitle, descriptionText))
	http.HandleFunc(subPath+"/", subscriptionHandler(configsPath, configsCache, subscriptionTitle, descriptionText))

	http.Handle("/", http.FileServerFS(static))
	http.Handle("/sub-link", http.HandlerFunc(getSubscriptionLink(subLink)))
	http.Handle("/statistic", http.HandlerFunc(getStatistic(statistic)))

	log.Printf("⚡ Server started on port: %v\n", port)
	log.Printf("✨✨ Check subscriptions: %v\n", subLink)
	log.Printf("🌊🌊 Check web: %v\n", webLink)

	err := http.ListenAndServe("0.0.0.0:"+port, nil)
	if err != nil {
		log.Fatal("error while starting subscription server: ", err)
	}
}

func getIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}

	var fallbackIP string

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

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

					if strings.HasPrefix(ipStr, "198.18.") {
						continue
					}

					if strings.HasPrefix(ipStr, "192.168.") {
						return ipStr
					}

					if ip.IsPrivate() {
						fallbackIP = ipStr
					}
				}
			}
		}
	}

	if fallbackIP != "" {
		return fallbackIP
	}

	return "127.0.0.1"
}
