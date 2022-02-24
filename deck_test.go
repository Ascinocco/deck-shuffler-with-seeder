package main

import (
	"io/ioutil"
	"log"
	"os"
	"testing"
)

// @TODO: Fix this from breaking when there are no blobs remaining
// func TestDeckShuffle(t *testing.T) {
// 	d := newDeck()

// 	if len(d) != 52 {
// 		t.Error("Invalid deck length, expected 52, got:", len(d))
// 	}

// 	blobs, blobErr := ioutil.ReadDir("./blobs")

// 	if blobErr != nil {
// 		t.Error("error parsing blobs dir", blobErr)
// 	}

// 	ioutil.WriteFile("./test_shuffles/init", []byte(d.toString()), 0666)

// 	for i := range blobs {
// 		d.shuffle()
// 		ioutil.WriteFile("./test_shuffles/s"+strconv.FormatInt(int64(i), 10), []byte(d.toString()), 0666)
// 	}
// }

func TestDeckOutput(t *testing.T) {
	initF, errF := os.Lstat("./test_shuffles/init")
	initFb, errFb := os.Lstat("./test_shuffles/init")

	if errF != nil || errFb != nil {
		log.Fatal(errFb)
	}

	initDeckMatches := os.SameFile(initF, initFb)

	if !initDeckMatches {
		log.Fatal("Init deck sanity check failed, matching decks do not match")
	}

	outputF, oF := ioutil.ReadDir("./test_shuffles")

	if oF != nil {
		log.Fatal(oF)
	}

	for i := 0; i < len(outputF); i++ {
		currF := outputF[i]
		fi, _ := os.Lstat("./test_shuffles/" + currF.Name())

		for j := 0; j < len(outputF); j++ {
			if i != j {
				nextF := outputF[j]
				fb, _ := os.Lstat("./test_shuffles/" + nextF.Name())
				same := os.SameFile(fi, fb)
				if same {
					log.Fatal("Err duplicate shuffle detected")
				}
			}
		}
	}
}
