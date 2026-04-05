#!/usr/bin/env node

/**
 * Kids Videos Ingestion Script
 *
 * Fetches videos from YouTube channels marked as kids channels and stores them in Appwrite.
 * Ingests both shorts (< 60s) and regular videos (≥ 60s).
 *
 * Usage: node scripts/ingest-videos.js
 */

const { Client, Databases, ID, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");

// Load environment variables
const envPath = path.join(__dirname, "..", ".env.local");
require("dotenv").config({ path: envPath });

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
const config = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: "69d2206900358e41513d",
  videosCollectionId: "69d2206b0018425b9cb5",
  channelsCollectionId: "69d22070003313a4fe51",
};

// Validate environment variables
function validateEnv() {
  const required = [
    "YOUTUBE_API_KEY",
    "EXPO_PUBLIC_APPWRITE_ENDPOINT",
    "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error("\n💡 Please add these to your .env.local file");
    process.exit(1);
  }
}

// Initialize Appwrite client
function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return new Databases(client);
}

// Parse ISO 8601 duration to seconds
function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

// Fetch videos from YouTube channel
async function fetchYouTubeVideos(channelId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    // Get channel info and uploads playlist ID
    const channelResponse = await fetch(
      `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${config.youtubeApiKey}`,
    );

    if (!channelResponse.ok) {
      throw new Error(
        `YouTube API error: ${channelResponse.status} ${channelResponse.statusText}`,
      );
    }

    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const channelName = channelData.items[0].snippet.title;
    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Fetch videos from uploads playlist with pagination
    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    console.log(`   Fetching videos (limit: ${maxResults === Infinity ? 'all' : maxResults})...`);

    while (maxResults === Infinity || allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${perPage}&key=${config.youtubeApiKey}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const playlistResponse = await fetch(playlistUrl);

      if (!playlistResponse.ok) {
        throw new Error(
          `YouTube API error: ${playlistResponse.status} ${playlistResponse.statusText}`,
        );
      }

      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }

      allVideoItems.push(...playlistData.items);
      
      if (maxResults !== Infinity) {
        console.log(`   Fetched ${Math.min(allVideoItems.length, maxResults)} / ${maxResults} videos...`);
      } else {
        console.log(`   Fetched ${allVideoItems.length} videos...`);
      }

      pageToken = playlistData.nextPageToken;

      if (!pageToken) {
        break;
      }
      
      if (maxResults !== Infinity && allVideoItems.length >= maxResults) {
        break;
      }
    }

    if (allVideoItems.length === 0) {
      return { channelId, channelName, videos: [] };
    }

    const limitedVideoItems = maxResults === Infinity ? allVideoItems : allVideoItems.slice(0, maxResults);

    // Fetch video details in batches
    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch
        .map((item) => item.contentDetails.videoId)
        .join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet&id=${videoIds}&key=${config.youtubeApiKey}`,
      );

      if (!videosResponse.ok) {
        throw new Error(
          `YouTube API error: ${videosResponse.status} ${videosResponse.statusText}`,
        );
      }

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);

      console.log(`   Processed details for ${allVideosData.length} videos...`);
    }

    // Transform to our format
    const videos = allVideosData.map((video) => ({
      videoId: video.id,
      title: video.snippet.title,
      thumbnailUrl:
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.medium?.url ||
        video.snippet.thumbnails.default?.url,
      duration: parseDuration(video.contentDetails.duration),
      uploadDate: video.snippet.publishedAt,
    }));

    return { channelId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch YouTube videos: ${error.message}`);
  }
}

// Get all existing videos from database
async function getAllExistingVideos(databases) {
  try {
    const allDocuments = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.videosCollectionId,
        [Query.limit(limit), Query.offset(offset)],
      );

      allDocuments.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    // Create map: videoId -> documentId
    const existingMap = new Map();
    allDocuments.forEach((doc) => {
      existingMap.set(doc.videoId, doc.$id);
    });

    return existingMap;
  } catch (error) {
    throw new Error(`Failed to fetch existing videos: ${error.message}`);
  }
}

// Create video document in database
async function createVideoDocument(databases, video, channelId) {
  const isShort = video.duration < 60;

  const document = {
    title: video.title,
    youtubeId: video.videoId, // YouTube video ID (permanent)
    videoId: null, // Storage file ID (set after upload)
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    uploadDate: video.uploadDate,
    channelId: channelId,
    isShort,
  };

  await databases.createDocument(
    config.databaseId,
    config.videosCollectionId,
    ID.unique(),
    document,
  );

  return document;
}

// Process a single channel
async function ingestChannelVideos(databases, existingMap, channel, maxResults = 5000, ingestMode = "all") {
  const channelId = channel.youtubeChannelId;
  const channelName = channel.name;
  
  console.log(`\n📺 Processing channel: ${channelId}`);
  console.log(`   Fetching videos from YouTube...`);

  const { videos } = await fetchYouTubeVideos(channelId, maxResults);
  
  console.log(`   ✅ Found ${videos.length} videos for channel: ${channelName}`);

  let newCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  let filteredCount = 0;

  for (const video of videos) {
    const { videoId, title, duration } = video;

    try {
      const isShort = duration < 60;

      // Apply ingest mode filter
      if (ingestMode === "shorts" && !isShort) {
        console.log(`   🚫 Filtered: ${title} (${duration}s, not a short)`);
        filteredCount++;
        continue;
      }
      
      if (ingestMode === "videos" && isShort) {
        console.log(`   🚫 Filtered: ${title} (${duration}s, is a short)`);
        filteredCount++;
        continue;
      }

      const existingVideo = existingMap.get(videoId);

      if (existingVideo) {
        console.log(`   ⏭️  Unchanged: ${title}`);
        unchangedCount++;
      } else {
        // New video - insert it
        try {
          await createVideoDocument(databases, video, channelId);
          console.log(`   ✅ Added: ${title} (${duration}s${isShort ? ', SHORT' : ''})`);
          newCount++;
        } catch (createError) {
          // Handle duplicate (race condition)
          if (
            createError.code === 409 ||
            createError.message.includes("already exists")
          ) {
            console.log(`   ⏭️  Skipped: ${title} (already exists)`);
            unchangedCount++;
          } else {
            throw createError;
          }
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${title}:`, error.message);
      errorCount++;
    }
  }

  return {
    channelId,
    channelName,
    newCount,
    unchangedCount,
    errorCount,
    filteredCount,
    totalVideos: videos.length,
  };
}

// Main ingestion function
async function ingestVideos() {
  console.log("🚀 Starting kids videos ingestion...\n");

  try {
    validateEnv();
    console.log("✅ Environment variables validated");

    const databases = initAppwrite();
    console.log("✅ Appwrite client initialized");

    // Fetch all kids channels from database
    console.log("\n📦 Fetching kids channels from database...");
    const channelsResponse = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("isKidsChannel", true), Query.limit(100)]
    );
    
    const channels = channelsResponse.documents;
    console.log(`✅ Found ${channels.length} kids channel(s) to process`);

    if (channels.length === 0) {
      console.log("\n⚠️  No kids channels found in database.");
      console.log("   Run 'npm run add:channel' to add channels first.");
      rl.close();
      process.exit(0);
    }

    // Ask what to ingest
    console.log("\n📊 What do you want to ingest?");
    console.log("   1. Shorts only (< 60 seconds)");
    console.log("   2. Videos only (≥ 60 seconds)");
    console.log("   3. All (both shorts and videos)");
    const ingestChoice = await question("\nChoice (1/2/3, default: 3): ");
    
    let ingestMode = "all";
    if (ingestChoice.trim() === "1") {
      ingestMode = "shorts";
      console.log("✅ Will ingest shorts only");
    } else if (ingestChoice.trim() === "2") {
      ingestMode = "videos";
      console.log("✅ Will ingest videos only");
    } else {
      ingestMode = "all";
      console.log("✅ Will ingest all videos");
    }

    // Ask for number of videos to process
    console.log("\n📊 How many videos do you want to process per channel?");
    console.log("   Enter a number (e.g., 100) or press Enter for all videos");
    const limitInput = await question("Limit (default: all): ");
    
    let maxResults = Infinity;
    if (limitInput.trim()) {
      const parsed = parseInt(limitInput.trim(), 10);
      if (!isNaN(parsed) && parsed > 0) {
        maxResults = parsed;
        console.log(`✅ Will process up to ${maxResults} videos per channel`);
      } else {
        console.log("⚠️  Invalid number, processing all videos");
      }
    } else {
      console.log("✅ Will process all videos");
    }

    console.log("\n📦 Fetching existing videos from database...");
    const existingMap = await getAllExistingVideos(databases);
    console.log(`✅ Found ${existingMap.size} existing videos in database`);

    // Process each channel
    const channelResults = [];
    for (const channel of channels) {
      try {
        const result = await ingestChannelVideos(databases, existingMap, channel, maxResults, ingestMode);
        channelResults.push(result);
      } catch (error) {
        console.error(`\n❌ Error processing channel ${channel.youtubeChannelId}:`, error.message);
        channelResults.push({
          channelId: channel.youtubeChannelId,
          channelName: channel.name || "Unknown",
          newCount: 0,
          unchangedCount: 0,
          errorCount: 0,
          filteredCount: 0,
          totalVideos: 0,
          error: error.message,
        });
      }
    }

    // Print per-channel statistics
    console.log("\n" + "=".repeat(60));
    console.log("📊 Per-Channel Statistics:");
    console.log("=".repeat(60));

    for (const result of channelResults) {
      console.log(`\n📺 ${result.channelName} (${result.channelId}):`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   📹 Total videos: ${result.totalVideos}`);
        console.log(`   ✅ New videos added: ${result.newCount}`);
        console.log(`   ⏭️  Videos unchanged: ${result.unchangedCount}`);
        console.log(`   🚫 Videos filtered: ${result.filteredCount}`);
        console.log(`   ❌ Errors: ${result.errorCount}`);
      }
    }

    // Print overall summary
    const totalNew = channelResults.reduce((sum, r) => sum + r.newCount, 0);
    const totalUnchanged = channelResults.reduce((sum, r) => sum + r.unchangedCount, 0);
    const totalErrors = channelResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalFiltered = channelResults.reduce((sum, r) => sum + r.filteredCount, 0);
    const totalVideos = channelResults.reduce((sum, r) => sum + r.totalVideos, 0);

    console.log("\n" + "=".repeat(60));
    console.log("📊 Overall Summary:");
    console.log("=".repeat(60));
    console.log(`   📺 Channels processed: ${channelResults.length}`);
    console.log(`   📹 Total videos processed: ${totalVideos}`);
    console.log(`   ✅ New videos added: ${totalNew}`);
    console.log(`   ⏭️  Videos unchanged: ${totalUnchanged}`);
    console.log(`   🚫 Videos filtered: ${totalFiltered}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log("\n✨ Ingestion complete!");
    
    rl.close();
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    rl.close();
    process.exit(1);
  }
}

// Run ingestion
ingestVideos();
