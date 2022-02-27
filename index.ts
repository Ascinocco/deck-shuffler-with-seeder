import { google } from "googleapis";
import puppeteer from "puppeteer";
import { EventEmitter } from "events";
import fs from "fs/promises";

require("dotenv").config();

const getMaxResultsFromEnv = () => {
  const m = process.env.MAX_RESULTS && parseInt(process.env.MAX_RESULTS);
  return typeof m === "number" && m > 0 ? m : 5;
};

const getNextBatchTimeoutFromEnv = () => {
  const m =
    process.env.NEXT_BATCH_TIMOUT && parseInt(process.env.NEXT_BATCH_TIMOUT);
  const timoutMinutes = typeof m === "number" && m > 0 ? m : 1;
  return timoutMinutes * 60000;
};

const maxResults = getMaxResultsFromEnv();
const batchTimeout = getNextBatchTimeoutFromEnv();

const getScreenshotPath = (id: string) => `./screenshots/${id}.png`;

enum SeederEvent {
  ReqLiveStream = "reqLiveStream",
  SaveScreenshot = "saveScreenshot",
  WriteBlobToDisk = "hashScreenshot",
}

const fetchLiveStreams = async (pageToken: string | null) =>
  google
    .youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    })
    .search.list({
      pageToken: pageToken || "",
      part: ["id"],
      eventType: "live",
      type: ["video"],
      maxResults,
    });

const em = new EventEmitter();
const browser = puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

type WriteBlobToDisk = {
  screenshotPath: string;
  blobId: string;
};

// convert a single screenshot to blob, write to disk
em.on(
  SeederEvent.WriteBlobToDisk,
  async ({ screenshotPath, blobId }: WriteBlobToDisk) => {
    if (!screenshotPath || !blobId) {
      throw new Error(
        "Screenshot path or blob id missing when attempting to write blob to disk"
      );
    }

    const imageFile = await fs.readFile(screenshotPath);
    const imageFileBuffer = Buffer.from(imageFile);
    await fs.writeFile(`./blobs/${blobId}`, imageFileBuffer);
    await fs.unlink(getScreenshotPath(blobId));
  }
);

type SaveScreenshot = {
  vid: string;
};

// save a single screenshot to file, write to disk
em.on(SeederEvent.SaveScreenshot, async ({ vid }: SaveScreenshot) => {
  if (!vid) {
    throw new Error("vid missing when attempting to write screenshot");
  }

  try {
    const page = await (await browser).newPage();
    await page.goto(`https://www.youtube.com/watch?v=${vid}`);
    await page.click("video", {
      delay: 2000,
    });

    const combinedId = `${vid}_${Date.now()}`;
    const path = getScreenshotPath(combinedId);
    await page.screenshot({ path });
    await page.close();

    em.emit(SeederEvent.WriteBlobToDisk, {
      screenshotPath: path,
      blobId: combinedId,
    });
  } catch {
    // swallow errors, just continue
  }
});

type ReqLiveStream = {
  pageToken?: string | null;
};

// request live streams
em.on(
  SeederEvent.ReqLiveStream,
  async ({ pageToken = null }: ReqLiveStream = {}) => {
    const { data } = await fetchLiveStreams(pageToken);
    console.log("processing batch...", pageToken);
    data.items?.forEach((ls) => {
      em.emit(SeederEvent.SaveScreenshot, {
        vid: ls.id?.videoId || null,
      });
    });

    const timeoutKey = setTimeout(async () => {
      console.log("token for next batch...", pageToken);
      em.emit(SeederEvent.ReqLiveStream, { pageToken: data.nextPageToken });
      clearTimeout(timeoutKey);
    }, batchTimeout);
  }
);

// bootstrap func
const bootstrap = () => {
  console.log("bootstraping seed generator service...");
  em.emit(SeederEvent.ReqLiveStream);
};

bootstrap();
