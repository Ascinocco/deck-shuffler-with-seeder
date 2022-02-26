"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const puppeteer_1 = (0, tslib_1.__importDefault)(require("puppeteer"));
const events_1 = require("events");
const promises_1 = (0, tslib_1.__importDefault)(require("fs/promises"));
require("dotenv").config();
const getMaxResultsFromEnv = () => {
    const m = process.env.MAX_RESULTS && parseInt(process.env.MAX_RESULTS);
    return typeof m === "number" && m > 0 ? m : 5;
};
const getNextBatchTimeoutFromEnv = () => {
    const m = process.env.NEXT_BATCH_TIMOUT && parseInt(process.env.NEXT_BATCH_TIMOUT);
    const timoutMinutes = typeof m === "number" && m > 0 ? m : 1;
    return timoutMinutes * 60000;
};
const maxResults = getMaxResultsFromEnv();
const batchTimeout = getNextBatchTimeoutFromEnv();
const getScreenshotPath = (id) => `./screenshots/${id}.png`;
var SeederEvent;
(function (SeederEvent) {
    SeederEvent["ReqLiveStream"] = "reqLiveStream";
    SeederEvent["SaveScreenshot"] = "saveScreenshot";
    SeederEvent["WriteBlobToDisk"] = "hashScreenshot";
    SeederEvent["Done"] = "done";
})(SeederEvent || (SeederEvent = {}));
const fetchLiveStreams = (pageToken) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    return googleapis_1.google
        .youtube({
        version: "v3",
        auth: process.env.YOUTUBE_API_KEY,
    })
        .search.list({
        pageToken,
        part: ["id"],
        eventType: "live",
        type: ["video"],
        maxResults,
    });
});
const em = new events_1.EventEmitter();
const browser = puppeteer_1.default.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const wroteAllFilesFromBatch = () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    const blobs = yield promises_1.default.readdir("./blobs");
    const blobsLengthWithoutGitkeep = blobs.length - 1;
    return blobsLengthWithoutGitkeep % maxResults === 0;
});
// start next batch of requests
em.on(SeederEvent.Done, ({ pageToken, fileNum }) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    if (fileNum % maxResults === 0) {
        const timeoutKey = setTimeout(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
            console.log("token for next batch...", pageToken);
            em.emit(SeederEvent.ReqLiveStream, { pageToken });
            clearTimeout(timeoutKey);
        }), batchTimeout);
    }
}));
// convert a single screenshot to blob, write to disk
em.on(SeederEvent.WriteBlobToDisk, ({ screenshotPath, blobId, pageToken, fileNum }) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    if (!screenshotPath || !blobId) {
        throw new Error("Screenshot path or blob id missing when attempting to write blob to disk");
    }
    const imageFile = yield promises_1.default.readFile(screenshotPath);
    const imageFileBuffer = Buffer.from(imageFile);
    yield promises_1.default.writeFile(`./blobs/${blobId}`, imageFileBuffer);
    yield promises_1.default.unlink(getScreenshotPath(blobId));
    em.emit(SeederEvent.Done, { pageToken, fileNum });
}));
// save a single screenshot to file, write to disk
em.on(SeederEvent.SaveScreenshot, ({ vid, pageToken, fileNum }) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    if (!vid || !pageToken) {
        throw new Error("vid or pageToken missing when attempting to write screenshot");
    }
    try {
        const page = yield (yield browser).newPage();
        yield page.goto(`https://www.youtube.com/watch?v=${vid}`);
        yield page.click("video", {
            delay: 2000,
        });
        const combinedId = `${vid}_${Date.now()}`;
        const path = getScreenshotPath(combinedId);
        yield page.screenshot({ path });
        yield page.close();
        em.emit(SeederEvent.WriteBlobToDisk, {
            screenshotPath: path,
            blobId: combinedId,
            pageToken,
            fileNum,
        });
    }
    catch (_a) {
        // swallow errors, just continue
    }
}));
// request live streams
em.on(SeederEvent.ReqLiveStream, ({ pageToken = "" } = {}) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    var _b;
    const { data } = yield fetchLiveStreams(pageToken);
    (_b = data.items) === null || _b === void 0 ? void 0 : _b.forEach((ls, i) => {
        var _a;
        em.emit(SeederEvent.SaveScreenshot, {
            vid: ((_a = ls.id) === null || _a === void 0 ? void 0 : _a.videoId) || null,
            pageToken: data.nextPageToken || null,
            fileNum: i + 1,
        });
    });
}));
// bootstrap func
const bootstrap = () => {
    em.emit(SeederEvent.ReqLiveStream);
};
bootstrap();
//# sourceMappingURL=index.js.map