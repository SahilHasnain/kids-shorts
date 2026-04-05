#!/usr/bin/env node

/**
 * Cleanup script to remove orphaned files and documents with invalid videoIds
 */

const { Client, Databases, Storage, Query } = require("node-appwrite");
const readline = require("readline");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = "69d2206900358e41513d";
const VIDEOS_COLLECTION_ID = "69d2206b0018425b9cb5";
const VIDEO_BUCKET_ID = "69d22086002f376ddbb3";

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function getAllVideos() {
  const allVideos = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(
      DATABASE_ID,
      VIDEOS_COLLECTION_ID,
      [Query.limit(limit), Query.offset(offset)]
    );

    allVideos.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allVideos;
}

async function getAllFiles() {
  const allFiles = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await storage.listFiles(VIDEO_BUCKET_ID, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allFiles.push(...response.files);

    if (response.files.length < limit) break;
    offset += limit;
  }

  return allFiles;
}

async function cleanup() {
  console.log("🧹 Kids Shorts Cleanup Script\n");

  try {
    console.log("📦 Fetching all videos from database...");
    const videos = await getAllVideos();
    console.log(`✅ Found ${videos.length} videos\n`);

    console.log("📦 Fetching all files from storage...");
    const files = await getAllFiles();
    console.log(`✅ Found ${files.length} files\n`);

    // Find videos with YouTube video IDs (< 20 chars, not UUID format)
    const videosWithYouTubeIds = videos.filter(
      (v) => v.videoId && v.videoId.length < 20
    );

    // Find orphaned files (files not referenced by any video)
    const videoIds = new Set(videos.map((v) => v.videoId));
    const orphanedFiles = files.filter((f) => !videoIds.has(f.$id));

    // Find videos without matching files
    const fileIds = new Set(files.map((f) => f.$id));
    const videosWithoutFiles = videos.filter(
      (v) => v.videoId && !fileIds.has(v.videoId)
    );

    console.log("📊 Analysis:");
    console.log(`  Videos with YouTube IDs (not uploaded): ${videosWithYouTubeIds.length}`);
    console.log(`  Orphaned files (no matching video): ${orphanedFiles.length}`);
    console.log(`  Videos without files (404 errors): ${videosWithoutFiles.length}\n`);

    if (videosWithYouTubeIds.length > 0) {
      console.log("🔍 Videos with YouTube IDs:");
      videosWithYouTubeIds.slice(0, 5).forEach((v) => {
        console.log(`  - ${v.title}`);
        console.log(`    videoId: ${v.videoId}`);
      });
      if (videosWithYouTubeIds.length > 5) {
        console.log(`  ... and ${videosWithYouTubeIds.length - 5} more\n`);
      }
    }

    if (orphanedFiles.length > 0) {
      console.log("\n🔍 Orphaned files:");
      orphanedFiles.slice(0, 5).forEach((f) => {
        const sizeMB = (f.sizeOriginal / 1024 / 1024).toFixed(2);
        console.log(`  - ${f.name} (${sizeMB}MB)`);
        console.log(`    File ID: ${f.$id}`);
      });
      if (orphanedFiles.length > 5) {
        console.log(`  ... and ${orphanedFiles.length - 5} more\n`);
      }
    }

    if (videosWithoutFiles.length > 0) {
      console.log("\n🔍 Videos without files (will cause 404):");
      videosWithoutFiles.slice(0, 5).forEach((v) => {
        console.log(`  - ${v.title}`);
        console.log(`    videoId: ${v.videoId}`);
      });
      if (videosWithoutFiles.length > 5) {
        console.log(`  ... and ${videosWithoutFiles.length - 5} more\n`);
      }
    }

    // Ask what to clean up
    console.log("\n🗑️  What do you want to clean up?");
    console.log("  1. Delete orphaned files only");
    console.log("  2. Delete videos without files only");
    console.log("  3. Delete both orphaned files and videos without files");
    console.log("  4. Cancel");

    const choice = await question("\nChoice (1/2/3/4): ");

    if (choice === "4" || !choice.trim()) {
      console.log("\n👋 Cancelled. No changes made.");
      rl.close();
      return;
    }

    let deletedFiles = 0;
    let deletedVideos = 0;

    // Delete orphaned files
    if (choice === "1" || choice === "3") {
      if (orphanedFiles.length > 0) {
        console.log(`\n🗑️  Deleting ${orphanedFiles.length} orphaned files...`);
        for (const file of orphanedFiles) {
          try {
            await storage.deleteFile(VIDEO_BUCKET_ID, file.$id);
            console.log(`  ✅ Deleted file: ${file.name}`);
            deletedFiles++;
          } catch (error) {
            console.error(`  ❌ Failed to delete ${file.name}: ${error.message}`);
          }
        }
      }
    }

    // Delete videos without files
    if (choice === "2" || choice === "3") {
      if (videosWithoutFiles.length > 0) {
        console.log(`\n🗑️  Deleting ${videosWithoutFiles.length} videos without files...`);
        for (const video of videosWithoutFiles) {
          try {
            await databases.deleteDocument(
              DATABASE_ID,
              VIDEOS_COLLECTION_ID,
              video.$id
            );
            console.log(`  ✅ Deleted video: ${video.title}`);
            deletedVideos++;
          } catch (error) {
            console.error(`  ❌ Failed to delete ${video.title}: ${error.message}`);
          }
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Cleanup Summary:");
    console.log(`  Files deleted: ${deletedFiles}`);
    console.log(`  Videos deleted: ${deletedVideos}`);
    console.log("=".repeat(60));
    console.log("\n✨ Cleanup complete!");

    rl.close();
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    rl.close();
    process.exit(1);
  }
}

cleanup();
