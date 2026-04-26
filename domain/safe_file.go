package domain

import (
	"log"
	"os"
	"sync"
)

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

func GetFile(filename string) *SafeFile {
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_RDWR|os.O_TRUNC, 0666)
	if err != nil {
		log.Fatalf("error opening %v file: %v\n", filename, err)
	}

	return &SafeFile{file: file, Name: filename}
}
