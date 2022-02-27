package main

import (
	"fmt"
	"hash/fnv"
	"io/ioutil"
	"log"
	"os"
	"time"

	"github.com/radovskyb/watcher"
)

// @TODO: Store seeds in db
// @TODO: Dockerize

func handleFileEvent(e watcher.Event, w *watcher.Watcher) {
	for _, f := range w.WatchedFiles() {
		if !f.IsDir() {
			bf, fileReadErr := ioutil.ReadFile("./blobs/" + f.Name())

			if fileReadErr != nil {
				fmt.Println("error reading file", fileReadErr)
			}

			h := fnv.New64a()
			h.Write(bf)
			hs := h.Sum64()

			fmt.Println(hs)

			os.Remove("./blobs/" + f.Name())
		}
	}
}

func main() {
	w := watcher.New()
	w.IgnoreHiddenFiles(true)
	w.SetMaxEvents(1)

	go func() {
		for {
			select {
			case event := <-w.Event:
				handleFileEvent(event, w)
			case err := <-w.Error:
				log.Fatalln("chan err", err)
			case <-w.Closed:
				return
			}
		}
	}()

	// Watch this folder for changes.
	if err := w.Add("./blobs"); err != nil {
		log.Fatalln("watch blobs err", err)
	}

	// Start the watching process - it'll check for changes every 100ms.
	if err := w.Start(time.Millisecond * 100); err != nil {
		log.Fatalln("died watching", err)
	}
}
