package main

import (
	"context"
	"fmt"
	"hash/fnv"
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"github.com/radovskyb/watcher"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// @TODO: Store seeds in db
// @TODO: Dockerize
var seeds *mongo.Collection
var ctx = context.TODO()

func getDbConnectionString() string {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("failed to parse .env file", err)
	}

	user := os.Getenv("MONGO_INITDB_SEED_WRITER_USERNAME")
	password := os.Getenv("MONGO_INITDB_SEED_WRITER_PASSWORD")
	port := os.Getenv("MONGO_PORT")
	url := os.Getenv("MONGO_CLUSTER_URL")
	dbName := os.Getenv("MONGO_DATABASE_NAME")

	return "mongodb://" + user + ":" + password + "@" + url + ":" + port + "/" + dbName
}

func insertSeed(s uint64) {
	_, err := seeds.InsertOne(ctx, bson.D{
		{Key: "_id", Value: primitive.NewObjectID()},
		{Key: "created_at", Value: time.Now()},
		{Key: "updated_at", Value: time.Now()},
		{Key: "seed", Value: strconv.FormatUint(s, 10)},
	})

	if err != nil {
		fmt.Println("Couldn't insert seed", err)
	}
}

func handleFileEvent(e watcher.Event, w *watcher.Watcher) {
	for _, f := range w.WatchedFiles() {
		if !f.IsDir() {
			bf, fileReadErr := ioutil.ReadFile("./blobs/" + f.Name())

			if fileReadErr != nil {
				fmt.Println("error reading file", fileReadErr)
			} else {
				h := fnv.New64a()
				h.Write(bf)
				hs := h.Sum64()

				fmt.Println(hs)
				go insertSeed(hs)

				os.Remove("./blobs/" + f.Name())
			}
		}
	}
}

func main() {
	fmt.Println("Bootstrapping seed store service...")
	clientOptions := options.Client().ApplyURI(getDbConnectionString())
	client, cErr := mongo.Connect(ctx, clientOptions)
	if cErr != nil {
		log.Fatal("Couldn't connect to mongodb", cErr)
	}

	pErr := client.Ping(ctx, nil)

	if pErr != nil {
		log.Fatal("Couldn't ping mongodb", pErr)
	}

	seeds = client.Database("seeds").Collection("seeds")

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
