package handler

import (
	"io/fs"
	"net/http"
	"os"
	"strings"
)

func Web(fileServer http.Handler, distFS fs.FS) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		_, err := fs.Stat(distFS, path)
		if os.IsNotExist(err) {
			r.URL.Path = "/"
		}

		fileServer.ServeHTTP(w, r)
	}
}
