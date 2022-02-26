package main

import (
	"fmt"
	"log"
	"time"

	"github.com/radovskyb/watcher"
)

// @TODO: remove deck logic, only generate hashes and store in db
// update where folders pull from

func main() {
	w := watcher.New()
	w.IgnoreHiddenFiles(true)
	w.SetMaxEvents(1)

	go func() {
		for {
			select {
			case event := <-w.Event:
				fmt.Println("chan event", event) // Print the event's info.
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

	for path, f := range w.WatchedFiles() {
		fmt.Printf("watches files - %s: %s\n", path, f.Name())
	}

	go func() {
		w.Wait()
		w.TriggerEvent(watcher.Create, nil)
		w.TriggerEvent(watcher.Remove, nil)
	}()

	// Start the watching process - it'll check for changes every 100ms.
	if err := w.Start(time.Millisecond * 100); err != nil {
		log.Fatalln("died watching", err)
	}
}
