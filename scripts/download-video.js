#!/usr/bin/env node

/**
 * Video Download and Upload Script for Kids Shorts
 *
 * This script:
 * 1. Fetches videos from the database that don't have videoId in storage
 * 2. Downloads video using yt-dlp from YouTube
 * 3. Uploads to Appwrite Storage (video-files bucket)
 * 4. Updates database with videoId
 *
 * Usage:
 *   node scripts/download-video.js [--limit=10] [--test] [--quality=720]
 *
 * Options:
 *   --limit=N      Process only N videos (default: all)
 *   --test         Test mode: download only, no upload
 *   --quality=N    Video quality: 480, 720, or 1080 (default: 720)
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { existsSync, mkdirSync, unlinkSync, statSync } = require("fs");
const { Client, Databases, Query, Storage, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const { dirname, extname, join, basename } = require("path");
const readline = require("readline");

// Load environment variables
dotenv.config({ path: ".env.local" });

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Configuration
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = "69d2206900358e41513d";
const VIDEOS_COLLECTION_ID = "69d2206b0018425b9cb5";
const CHANNELS_COLLECTION_ID = "69d22070003313a4fe51";
const VIDEO_BUCKET_ID = "69d22086002f376ddbb3";

// Parse command line arguments
const args = process.argv.slice(2);
const limit =
  parseInt(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1]) ||
  null;
const testMode = args.includes("--test");
const quality =
  parseInt(args.find((arg) => arg.startsWith("--quality="))?.split("=")[1]) ||
  720;

// Validate quality
if (![480, 720, 1080].includes(quality)) {
  console.error("❌ Invalid quality. Must be 480, 720, or 1080");
  process.exit(1);
}

// Temp directory for downloads
const TEMP_DIR = join(process.cwd(), "temp-video");

// Initialize Appwrite
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(`${command} failed with code ${code}${stderr ? `: ${stderr}` : ""}`)
        );
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });
  });
}

async function getVideoCodec(filePath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  return stdout.trim().toLowerCase();
}

async function ensureH264Compatible(filePath) {
  const codec = await getVideoCodec(filePath);
  console.log(`  Video codec: ${codec || "unknown"}`);

  if (codec === "h264") {
    return filePath;
  }

  const transcodedPath = join(
    dirname(filePath),
    `${basename(filePath, extname(filePath))}_h264.mp4`
  );

  console.log("  Transcoding to H.264/AAC for Android compatibility...");

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    transcodedPath,
  ]);

  const transcodedCodec = await getVideoCodec(transcodedPath);
  if (transcodedCodec !== "h264") {
    throw new Error(`Transcode failed, resulting codec is ${transcodedCodec}`);
  }

  console.log("  ✓ Transcoded successfully");
  return transcodedPath;
}

/**
 * Ensure temp directory exists
 */
function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`✓ Created temp directory: ${TEMP_DIR}`);
  }
}

/**
 * Download video using yt-dlp
 */
async function downloadVideo(videoId, title) {
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const outputPath = join(TEMP_DIR, `${videoId}_${sanitizedTitle}.mp4`);

  console.log(`  Downloading: ${title}`);
  console.log(`  Video ID: ${videoId}`);
  console.log(`  Target Quality: ${quality}p`);

  return new Promise((resolve, reject) => {
    const formatString = `bestvideo[vcodec^=avc1][height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[vcodec^=avc1][height<=${quality}][ext=mp4]/bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best`;

    const ytdlp = spawn("yt-dlp", [
      "-f",
      formatString,
      "--merge-output-format",
      "mp4",
      "--max-filesize",
      "500M",
      "--no-playlist",
      "-o",
      outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    let errorOutput = "";

    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ytdlp.stdout.on("data", (data) => {
      process.stdout.write(".");
    });

    ytdlp.on("close", (code) => {
      console.log("");

      if (code === 0 && existsSync(outputPath)) {
        const stats = statSync(outputPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`  ✓ Downloaded successfully (${sizeMB}MB)`);
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Upload video file to Appwrite Storage
 */
async function uploadVideo(filePath, videoId) {
  console.log(`  Uploading to Appwrite Storage...`);

  try {
    const fileName = `${videoId}.mp4`;
    const fileSize = statSync(filePath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    console.log(`  File size: ${fileSizeMB}MB`);

    if (fileSize > 500 * 1024 * 1024) {
      throw new Error(`File too large: ${fileSizeMB}MB (max 500MB)`);
    }

    const file = await storage.createFile(
      VIDEO_BUCKET_ID,
      ID.unique(),
      InputFile.fromPath(filePath, fileName)
    );

    console.log(`  ✓ Uploaded: ${file.$id}`);
    return file.$id;
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`  ✓ Cleaned up temp file`);
    }
  } catch (error) {
    console.warn(`  ⚠ Failed to cleanup: ${error.message}`);
  }
}

/**
 * Update video document with storage file ID
 */
async function updateVideoWithFileId(videoDocId, storageFileId) {
  await databases.updateDocument(DATABASE_ID, VIDEOS_COLLECTION_ID, videoDocId, {
    videoId: storageFileId,
  });
  console.log(`  ✓ Updated video document with storage file ID`);
}

/**
 * Process a single video
 */
async function processVideo(video, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${video.title}`);

  let tempFilePath = null;
  let uploadFilePath = null;

  try {
    // Download video
    tempFilePath = await downloadVideo(video.videoId, video.title);
    uploadFilePath = await ensureH264Compatible(tempFilePath);

    if (!testMode) {
      // Upload to Appwrite (generates unique file ID)
      const storageFileId = await uploadVideo(uploadFilePath, video.videoId);
      
      // Update database with storage file ID
      await updateVideoWithFileId(video.$id, storageFileId);
    } else {
      console.log(`  ℹ️  Test mode: skipping upload`);
    }

    console.log(`  ✅ Success!`);
    return { success: true, videoId: video.videoId };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, videoId: video.videoId, error: error.message };
  } finally {
    if (tempFilePath && !testMode) {
      cleanupTempFile(tempFilePath);
    }
    if (uploadFilePath && uploadFilePath !== tempFilePath && !testMode) {
      cleanupTempFile(uploadFilePath);
    }
  }
}

/**
 * Fetch all videos without uploaded files using pagination
 */
async function fetchAllVideosWithoutFile(userLimit = null, uploadMode = "all", selectedChannelIds = null) {
  const BATCH_SIZE = 100;
  let allVideos = [];
  let offset = 0;
  let hasMore = true;

  console.log("📥 Fetching videos from database in batches...");

  while (hasMore) {
    const queries = [
      Query.limit(BATCH_SIZE),
      Query.offset(offset),
    ];

    const response = await databases.listDocuments(
      DATABASE_ID,
      VIDEOS_COLLECTION_ID,
      queries
    );

    let batch = response.documents;
    
    // Filter out videos that already have videoId (storage file ID) set
    // When videoId is set, it means the file has been uploaded to storage
    batch = batch.filter(video => !video.videoId || video.videoId.length < 20);
    
    // Filter by selected channels if specified
    if (selectedChannelIds && selectedChannelIds.length > 0) {
      batch = batch.filter(video => selectedChannelIds.includes(video.channelId));
    }
    
    // Filter based on upload mode
    if (uploadMode === "shorts") {
      batch = batch.filter(video => video.duration < 60);
    } else if (uploadMode === "videos") {
      batch = batch.filter(video => video.duration >= 60);
    }
    
    allVideos.push(...batch);

    console.log(
      `  Fetched batch: ${batch.length} videos (total: ${allVideos.length})`
    );

    hasMore = response.documents.length === BATCH_SIZE;
    offset += BATCH_SIZE;

    if (userLimit && allVideos.length >= userLimit) {
      allVideos = allVideos.slice(0, userLimit);
      hasMore = false;
    }
  }

  return allVideos;
}

/**
 * Main function
 */
async function main() {
  console.log("🎥 Video Download and Upload Script (Kids Shorts)\n");
  console.log("Configuration:");
  console.log(`  Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`  Project: ${APPWRITE_PROJECT_ID}`);
  console.log(`  Database: ${DATABASE_ID}`);
  console.log(`  Collection: ${VIDEOS_COLLECTION_ID}`);
  console.log(`  Bucket: ${VIDEO_BUCKET_ID}`);
  console.log(`  Quality: ${quality}p`);
  console.log(`  Limit: ${limit || "All videos"}`);
  console.log(
    `  Mode: ${testMode ? "Test (no upload)" : "Full (download + upload)"}\n`
  );

  // Fetch available channels
  console.log("📦 Fetching channels from database...");
  const channelsResponse = await databases.listDocuments(
    DATABASE_ID,
    CHANNELS_COLLECTION_ID,
    [Query.equal("isKidsChannel", true), Query.limit(100)]
  );
  
  const allChannels = channelsResponse.documents;
  console.log(`✅ Found ${allChannels.length} kids channel(s) in database\n`);

  let selectedChannelIds = null;
  
  if (allChannels.length > 0) {
    console.log("📺 Available channels:");
    allChannels.forEach((channel, index) => {
      console.log(`   ${index + 1}. ${channel.name} (${channel.youtubeChannelId})`);
    });
    
    console.log("\n🎯 Which channels do you want to upload videos from?");
    console.log("   Enter numbers separated by commas (e.g., 1,3,5)");
    console.log("   Or press Enter to upload from ALL channels");
    const selectionInput = await question("\nSelection (default: all): ");
    
    if (selectionInput.trim()) {
      const selectedIndices = selectionInput
        .split(",")
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(i => !isNaN(i) && i >= 0 && i < allChannels.length);
      
      if (selectedIndices.length === 0) {
        console.log("⚠️  Invalid selection, processing all channels\n");
      } else {
        const selectedChannels = selectedIndices.map(i => allChannels[i]);
        selectedChannelIds = selectedChannels.map(c => c.youtubeChannelId);
        console.log(`✅ Selected ${selectedChannels.length} channel(s):`);
        selectedChannels.forEach(c => console.log(`   - ${c.name}`));
        console.log("");
      }
    } else {
      console.log("✅ Will process all channels\n");
    }
  }

  // Ask what to upload
  console.log("📊 What do you want to upload?");
  console.log("   1. Shorts only (< 60 seconds)");
  console.log("   2. Videos only (≥ 60 seconds)");
  console.log("   3. All (both shorts and videos)");
  const uploadChoice = await question("\nChoice (1/2/3, default: 3): ");
  
  let uploadMode = "all";
  if (uploadChoice.trim() === "1") {
    uploadMode = "shorts";
    console.log("✅ Will upload shorts only\n");
  } else if (uploadChoice.trim() === "2") {
    uploadMode = "videos";
    console.log("✅ Will upload videos only\n");
  } else {
    uploadMode = "all";
    console.log("✅ Will upload all videos\n");
  }

  ensureTempDir();

  const videos = await fetchAllVideosWithoutFile(limit, uploadMode, selectedChannelIds);
  console.log(`✓ Found ${videos.length} videos without uploaded files\n`);

  if (videos.length === 0) {
    console.log("No videos to process. All videos already uploaded!");
    rl.close();
    return;
  }

  const results = [];
  for (let i = 0; i < videos.length; i++) {
    const result = await processVideo(videos[i], i, videos.length);
    results.push(result);

    if (i < videos.length - 1) {
      console.log("  ⏳ Waiting 3 seconds before next download...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  Total processed: ${results.length}`);
  console.log(`  Successful: ${results.filter((r) => r.success).length}`);
  console.log(`  Failed: ${results.filter((r) => !r.success).length}`);

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.log("\n❌ Failed videos:");
    failed.forEach((f) => {
      console.log(`  - ${f.videoId}: ${f.error}`);
    });
  }

  console.log("=".repeat(60));

  if (testMode) {
    console.log(`\n✅ Test completed! Video files saved to: ${TEMP_DIR}`);
  } else {
    console.log("\n✅ Done! All video files uploaded to Appwrite Storage");
  }
  
  rl.close();
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  rl.close();
  process.exit(1);
});
