package logging

import (
	"log"
	"os"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Log *zap.Logger

const LogPath = "app.log"
const maxLogSize = 25 * 1024 * 1024 // 25 MB

type rotatingWriter struct {
	mu       sync.Mutex
	filename string
	file     *os.File
	size     int64
}

func (w *rotatingWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.size+int64(len(p)) > maxLogSize {
		w.rotate()
	}

	if w.file == nil {
		return 0, os.ErrClosed
	}
	n, err = w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func (w *rotatingWriter) Sync() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file != nil {
		return w.file.Sync()
	}
	return nil
}

func (w *rotatingWriter) rotate() {
	if w.file != nil {
		w.file.Close()
	}

	tmpName := w.filename + ".tmp"
	tmpFile, err := os.Create(tmpName)
	if err != nil {
		log.Println("failed to create tmp log file:", err)
		w.file, _ = os.OpenFile(w.filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		return
	}
	tmpFile.Close()

	if err := os.Rename(tmpName, w.filename); err != nil {
		log.Println("failed to rename log file on rotate:", err)
	}

	file, err := os.OpenFile(w.filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Println("failed to open log file after rotation:", err)
		w.file = nil
	} else {
		w.file = file
		w.size = 0
	}
}

func newRotatingWriter(filename string) *rotatingWriter {
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file %s: %v", filename, err)
	}
	stat, _ := file.Stat()
	size := int64(0)
	if stat != nil {
		size = stat.Size()
	}
	return &rotatingWriter{
		filename: filename,
		file:     file,
		size:     size,
	}
}

func Initialize() {
	file := getFile(LogPath)
	resetFile(file)
	file.Close()

	rw := newRotatingWriter(LogPath)
	log.SetOutput(rw)
	setLogger(rw)
}

func setLogger(rw *rotatingWriter) {
	encoderCfg := zap.NewProductionEncoderConfig()
	encoder := zapcore.NewJSONEncoder(encoderCfg)
	core := zapcore.NewCore(encoder, zapcore.AddSync(rw), zap.InfoLevel)
	Log = zap.New(core)
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
		log.Fatalf("error opening file %s: %v", filename, err)
	}

	return file
}
