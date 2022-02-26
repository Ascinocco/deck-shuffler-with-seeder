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
  Done = "done",
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

type Done = {
  pageToken: string;
  fileNum: number;
};

// @TODO: Add file limit checks
// if we've reached the file limit and want to continue (check env var and watch fs?)
// copy files to dir for go to process and continue
// if we've reach the file limit and want to end
// copy files for go to process and exit
// @TODO: dockerize

// start next batch of requests
em.on(SeederEvent.Done, async ({ pageToken, fileNum }: Done) => {
  if (fileNum % maxResults === 0) {
    const timeoutKey = setTimeout(async () => {
      console.log("token for next batch...", pageToken);
      em.emit(SeederEvent.ReqLiveStream, { pageToken });
      clearTimeout(timeoutKey);
    }, batchTimeout);
  }
});

type WriteBlobToDisk = {
  screenshotPath: string;
  blobId: string;
  pageToken: string;
  fileNum: string;
  batchDir: string;
};

// convert a single screenshot to blob, write to disk
em.on(
  SeederEvent.WriteBlobToDisk,
  async ({
    screenshotPath,
    blobId,
    pageToken,
    fileNum,
    batchDir,
  }: WriteBlobToDisk) => {
    if (!screenshotPath || !blobId) {
      throw new Error(
        "Screenshot path or blob id missing when attempting to write blob to disk"
      );
    }

    const imageFile = await fs.readFile(screenshotPath);
    const imageFileBuffer = Buffer.from(imageFile);
    await fs.writeFile(`./blobs/${batchDir}/${blobId}`, imageFileBuffer);
    await fs.unlink(getScreenshotPath(blobId));
    em.emit(SeederEvent.Done, { pageToken, fileNum });
  }
);

type SaveScreenshot = {
  vid: string;
  pageToken: string | null;
  fileNum: number;
  batchDir: string;
};

// save a single screenshot to file, write to disk
em.on(
  SeederEvent.SaveScreenshot,
  async ({ vid, pageToken, fileNum, batchDir }: SaveScreenshot) => {
    if (!vid || !pageToken) {
      throw new Error(
        "vid or pageToken missing when attempting to write screenshot"
      );
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
        pageToken,
        fileNum,
        batchDir,
      });
    } catch {
      // swallow errors, just continue
    }
  }
);

type ReqLiveStream = {
  pageToken?: string | null;
};

// request live streams
em.on(
  SeederEvent.ReqLiveStream,
  async ({ pageToken = null }: ReqLiveStream = {}) => {
    const { data } = await fetchLiveStreams(pageToken);
    const batchDir = `./blobs/${pageToken || "first"}_${Date.now()}`;
    await fs.mkdir(batchDir);

    data.items?.forEach((ls, i) => {
      em.emit(SeederEvent.SaveScreenshot, {
        vid: ls.id?.videoId || null,
        pageToken: data.nextPageToken || null,
        fileNum: i + 1,
        batchDir,
      });
    });
  }
);

// bootstrap func
const bootstrap = () => {
  em.emit(SeederEvent.ReqLiveStream);
};

bootstrap();
