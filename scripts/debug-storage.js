#!/usr/bin/env node

/**
 * Debug script to check database vs storage consistency
 */

const { Client, Databases, Storage, Query } = require("node-appwrite");
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

async function debug() {
  console.log("🔍 Debugging Kids Shorts Storage\n");
  console.log("Configuration:");
  console.log(`  Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`  Project: ${APPWRITE_PROJECT_ID}`);
  console.log(`  Database: ${DATABASE_ID}`);
  console.log(`  Videos Collection: ${VIDEOS_COLLECTION_ID}`);
  console.log(`  Storage Bucket: ${VIDEO_BUCKET_ID}\n`);

  try {
    // Check database videos
    console.log("📦 Checking database videos...");
    const videosResponse = await databases.listDocuments(
      DATABASE_ID,
      VIDEOS_COLLECTION_ID,
      [Query.limit(10)]
    );
    
    console.log(`✅ Found ${videosResponse.total} total videos in database`);
    console.log(`\nFirst 10 videos:`);
    videosResponse.documents.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.title}`);
      console.log(`     videoId: ${doc.videoId}`);
      console.log(`     isShort: ${doc.isShort}`);
      console.log(`     channelId: ${doc.channelId}`);
    });

    // Check storage files
    console.log("\n📦 Checking storage files...");
    const filesResponse = await storage.listFiles(VIDEO_BUCKET_ID, [
      Query.limit(10)
    ]);
    
    console.log(`✅ Found ${filesResponse.total} total files in storage`);
    console.log(`\nFirst 10 files:`);
    filesResponse.files.forEach((file, i) => {
      const sizeMB = (file.sizeOriginal / 1024 / 1024).toFixed(2);
      console.log(`  ${i + 1}. ${file.name}`);
      console.log(`     File ID: ${file.$id}`);
      console.log(`     Size: ${sizeMB}MB`);
    });

    // Check if videoIds match file IDs
    console.log("\n🔍 Checking videoId consistency...");
    const videoIds = videosResponse.documents.map(d => d.videoId);
    const fileIds = filesResponse.files.map(f => f.$id);
    
    const matchingIds = videoIds.filter(id => fileIds.includes(id));
    console.log(`  Matching IDs: ${matchingIds.length} / ${videoIds.length}`);
    
    if (matchingIds.length === 0) {
      console.log("\n⚠️  WARNING: No matching IDs found!");
      console.log("  This means videoId in database doesn't match file IDs in storage.");
      console.log("\n  Sample videoId from database:", videoIds[0]);
      console.log("  Sample file ID from storage:", fileIds[0]);
      console.log("\n  Possible issues:");
      console.log("  1. Videos uploaded to wrong bucket");
      console.log("  2. Database not updated after upload");
      console.log("  3. Using YouTube video IDs instead of storage file IDs");
    }

    // Test video URL construction
    console.log("\n🔗 Testing video URL construction...");
    const sampleVideo = videosResponse.documents[0];
    const testUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${VIDEO_BUCKET_ID}/files/${sampleVideo.videoId}/view?project=${APPWRITE_PROJECT_ID}`;
    console.log(`  Sample URL: ${testUrl}`);
    
    // Try to fetch the file
    try {
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`  ✅ URL is accessible (${response.status})`);
      } else {
        console.log(`  ❌ URL returned ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ Failed to fetch: ${error.message}`);
    }

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

debug();
