package logging

import (
	"log"
	"os"

	"go.uber.org/zap"
)

var Log *zap.Logger

const LogPath = "app.log"

func Initialize() {
	file := getFile(LogPath)
	resetFile(file)
	setLogger()
}

func setLogger() {
	cfg := zap.NewProductionConfig()
	cfg.OutputPaths = []string{"stdout", LogPath}
	cfg.ErrorOutputPaths = []string{"stderr", LogPath}

	var err error
	Log, err = cfg.Build()
	if err != nil {
		log.Fatalf("failed to initialize logger: %v", err)
	}
}

func resetFile(file *os.File) {
	if err := file.Truncate(0); err != nil {
		log.Println("failed to truncate log file:", LogPath, "error:", err)
	}

	if _, err := file.Seek(0, 0); err != nil {
		log.Println("failed to seek log file:", LogPath, "error:", err)
	}
}

func getFile(filename string) *os.File {
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_RDWR, 0666)
	if err != nil {
		Log.Fatal("error opening file", zap.String("filename", filename), zap.Error(err))
	}

	return file
}
