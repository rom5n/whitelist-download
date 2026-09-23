package browser

import (
	"fmt"

	pkgbrowser "github.com/pkg/browser"
	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

// Open opens the default web browser to the local app URL if autoBrowserOpen is true.
func Open(port string, autoBrowserOpen bool) {
	if !autoBrowserOpen {
		return
	}

	url := fmt.Sprintf("http://localhost:%s/", port)

	err := pkgbrowser.OpenURL(url)
	if err != nil {
		logging.Log.Error("failed to open default browser", zap.Error(err), zap.String("url", url))
	} else {
		logging.Log.Info("opened default browser", zap.String("url", url))
	}
}
