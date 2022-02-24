package main

import (
	"fmt"
	"hash/fnv"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"
)

// @TODO: Extract deck func. to dedicated file
// @TODO: Add tests to see how random
type deck []string

func newDeck() deck {
	cards := deck{}

	suits := []string{"Spades", "Diamonds", "Hearts", "Clubs"}
	values := []string{"Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King"}

	for _, suit := range suits {
		for _, value := range values {
			cards = append(cards, value+" of "+suit)
		}
	}

	return cards
}

func (d deck) toString() string {
	return strings.Join([]string(d), ",")
}

func (d deck) shuffle() {
	pIds := len(d) - 1

	files, errDir := ioutil.ReadDir("./blobs")

	if errDir != nil {
		log.Fatal(errDir)
	}

	fIdx := len(files) - 1

	fIndxSrc := rand.NewSource(time.Now().UnixNano())
	fr := rand.New(fIndxSrc)

	f := files[fr.Intn(fIdx)]

	nfb, errFile := ioutil.ReadFile("./blobs/" + f.Name())

	if errFile != nil {
		log.Fatal(errFile)
	}

	h := fnv.New64a()
	h.Write(nfb)
	hs := h.Sum64()

	fmt.Println(f.Name())
	fmt.Println(hs)

	source := rand.NewSource(int64(hs))
	r := rand.New(source)

	for i := range d {
		np := r.Intn(pIds)
		d[i], d[np] = d[np], d[i]
	}

	os.Remove("./blobs/" + f.Name())
}

func (d deck) print() {
	for _, card := range d {
		fmt.Println(card)
	}
}
