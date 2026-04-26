package logging

import (
	"log"

	"github.com/rom5n/whitelist-download/domain"
)

func ConfigureLogging(filepath string) {
	logFile := domain.GetFile(filepath)

	log.SetOutput(logFile)

	resetFile(logFile, filepath)
}

func resetFile(file *domain.SafeFile, name string) {
	if err := file.Truncate(0); err != nil {
		log.Println("failed to truncate file:", name, "error:", err)
	}

	if _, err := file.Seek(0, 0); err != nil {
		log.Println("failed to seek file:", name, "error:", err)
	}
}
