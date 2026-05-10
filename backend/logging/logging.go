package logging

import (
	"log"

	"github.com/rom5n/whitelist-download/backend/config"
	"github.com/rom5n/whitelist-download/backend/domain"
)

func Configure(cfg *config.Config) {
	cfg.RLock()
	path := cfg.LogsPath
	cfg.RUnlock()

	logFile := domain.GetFile(path)

	log.SetOutput(logFile)

	resetFile(logFile, path)
}

func resetFile(file *domain.SafeFile, name string) {
	if err := file.Truncate(0); err != nil {
		log.Println("failed to truncate file:", name, "error:", err)
	}

	if _, err := file.Seek(0, 0); err != nil {
		log.Println("failed to seek file:", name, "error:", err)
	}
}
