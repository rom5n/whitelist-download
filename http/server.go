package http

import (
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/rom5n/whitelist-download/domain"
)

func StartHttpSubscriptionServer(configsFile *domain.SafeFile, configsCache *domain.SafeConfigsCache, subPath, port, subscriptionTitle, descriptionText string) {
	http.HandleFunc(subPath, subscriptionHandler(configsFile, configsCache, subscriptionTitle, descriptionText))
	http.HandleFunc(subPath+"/", subscriptionHandler(configsFile, configsCache, subscriptionTitle, descriptionText))

	log.Printf("⚡ Subscription server started on port: %v\n", port)
	log.Printf("✨✨ Check it: %v\n", "http://"+getIP()+":"+port+subPath+"/15")

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
