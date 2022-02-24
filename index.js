const { google } = require("googleapis");
const fs = require("fs");
const puppeteer = require("puppeteer");
require("dotenv").config();

const RESULTS_TO_PARSE = 50;

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const searchForLiveStreams = () =>
  google
    .youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    })
    .search.list({
      part: ["id"],
      eventType: "live",
      type: ["video"],
      maxResults: RESULTS_TO_PARSE,
    });

const rndInts = (amount = 1) => {
  ri = [];
  for (let i = 0; i <= amount; i++) {
    ri.push(Math.floor(Math.random() * RESULTS_TO_PARSE));
  }
  return ri;
};

(async function () {
  const screenshotsToConvert = [];
  const { data } = await searchForLiveStreams();
  const rnds = rndInts(RESULTS_TO_PARSE);
  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  for (let i = 0; i < rnds.length; i++) {
    const rnd = rnds[i];
    const vid = data.items[rnd].id.videoId;
    const page = await browser.newPage();
    await page.goto(`https://www.youtube.com/watch?v=${vid}`);
    await page.click("video", {
      delay: 3000,
    });
    await sleep(3000);
    const path = `./screenshots/${vid}_screenshot.png`;
    screenshotsToConvert.push({
      path,
      id: vid,
    });
    await page.screenshot({ path });
    await sleep(1000);
    await page.close();
  }

  await browser.close();

  screenshotsToConvert.forEach((sp) => {
    const f = fs.readFileSync(sp.path);
    const b = Buffer.from(f);
    fs.writeFileSync(`./blobs/${sp.id}`, b);
  });
})();
