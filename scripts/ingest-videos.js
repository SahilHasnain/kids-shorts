#!/usr/bin/env node

const { Client, Databases, ID, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
require("dotenv").config({ path: envPath });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

const config = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: "69d2206900358e41513d",
  videosCollectionId: "69d2206b0018425b9cb5",
  channelsCollectionId: "69d22070003313a4fe51",
};

function validateEnv() {
  const required = [
    "YOUTUBE_API_KEY",
    "EXPO_PUBLIC_APPWRITE_ENDPOINT",
    "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach((key) => console.error(`- ${key}`));
    process.exit(1);
  }
}

function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return new Databases(client);
}

function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || 0, 10) * 3600 +
    parseInt(match[2] || 0, 10) * 60 +
    parseInt(match[3] || 0, 10)
  );
}

async function fetchPlaylistItems(playlistId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const allVideoIds = [];
  let pageToken = null;

  while (maxResults === Infinity || allVideoIds.length < maxResults) {
    let url = `${baseUrl}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50&key=${config.youtubeApiKey}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      break;
    }

    allVideoIds.push(...data.items.map((item) => item.contentDetails.videoId));
    pageToken = data.nextPageToken;
    if (!pageToken) {
      break;
    }
  }

  const limitedIds = maxResults === Infinity ? allVideoIds : allVideoIds.slice(0, maxResults);
  const videos = [];

  for (let i = 0; i < limitedIds.length; i += 50) {
    const batchIds = limitedIds.slice(i, i + 50);
    const response = await fetch(
      `${baseUrl}/videos?part=contentDetails,snippet&id=${batchIds.join(",")}&key=${config.youtubeApiKey}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    videos.push(
      ...(data.items || []).map((video) => ({
        videoId: video.id,
        title: video.snippet.title,
        thumbnailUrl:
          video.snippet.thumbnails.high?.url ||
          video.snippet.thumbnails.medium?.url ||
          video.snippet.thumbnails.default?.url,
        duration: parseDuration(video.contentDetails.duration),
        uploadDate: video.snippet.publishedAt,
      }))
    );
  }

  return videos;
}

async function fetchChannelVideos(channelId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const response = await fetch(
    `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${config.youtubeApiKey}`
  );

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const sourceName = data.items[0].snippet.title;
  const uploadsPlaylistId = data.items[0].contentDetails.relatedPlaylists.uploads;
  const videos = await fetchPlaylistItems(uploadsPlaylistId, maxResults);

  return { sourceName, videos };
}

async function fetchPlaylistVideos(playlistId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const response = await fetch(
    `${baseUrl}/playlists?part=snippet&id=${playlistId}&key=${config.youtubeApiKey}`
  );

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`Playlist not found: ${playlistId}`);
  }

  const sourceName = data.items[0].snippet.title;
  const videos = await fetchPlaylistItems(playlistId, maxResults);

  return { sourceName, videos };
}

async function getAllExistingVideos(databases) {
  const existingMap = new Map();
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(
      config.databaseId,
      config.videosCollectionId,
      [Query.limit(limit), Query.offset(offset)]
    );

    response.documents.forEach((doc) => {
      existingMap.set(doc.youtubeId || doc.videoId, doc.$id);
    });

    if (response.documents.length < limit) {
      break;
    }
    offset += limit;
  }

  return existingMap;
}

async function createVideoDocument(databases, video, sourceId, sourceName) {
  return databases.createDocument(
    config.databaseId,
    config.videosCollectionId,
    ID.unique(),
    {
      title: video.title,
      youtubeId: video.videoId,
      videoId: null,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      uploadDate: video.uploadDate,
      channelId: sourceId,
      channelName: sourceName,
      isShort: video.duration < 60,
    }
  );
}

async function ingestSourceVideos(databases, existingMap, source, maxResults, ingestMode) {
  const sourceType = source.type || "channel";
  const sourceId = source.youtubeChannelId;
  const sourceData =
    sourceType === "playlist"
      ? await fetchPlaylistVideos(sourceId, maxResults)
      : await fetchChannelVideos(sourceId, maxResults);

  let newCount = 0;
  let unchangedCount = 0;
  let filteredCount = 0;
  let errorCount = 0;

  for (const video of sourceData.videos) {
    try {
      const isShort = video.duration < 60;
      if (ingestMode === "shorts" && !isShort) {
        filteredCount++;
        continue;
      }
      if (ingestMode === "videos" && isShort) {
        filteredCount++;
        continue;
      }
      if (existingMap.has(video.videoId)) {
        unchangedCount++;
        continue;
      }

      await createVideoDocument(databases, video, sourceId, sourceData.sourceName);
      existingMap.set(video.videoId, true);
      newCount++;
    } catch (error) {
      console.error(`Error processing ${video.title}: ${error.message}`);
      errorCount++;
    }
  }

  return {
    sourceId,
    sourceName: source.name || sourceData.sourceName,
    sourceType,
    totalVideos: sourceData.videos.length,
    newCount,
    unchangedCount,
    filteredCount,
    errorCount,
  };
}

async function main() {
  try {
    validateEnv();
    const databases = initAppwrite();

    const sourcesResponse = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.limit(100)]
    );

    const sources = sourcesResponse.documents;
    if (sources.length === 0) {
      console.log("No sources found in database.");
      console.log("Run 'npm run add:channel' to add channels or playlists first.");
      return;
    }

    console.log("What do you want to ingest?");
    console.log("1. Shorts only (< 60 seconds)");
    console.log("2. Videos only (>= 60 seconds)");
    console.log("3. All");
    const choice = await question("Choice (1/2/3, default: 3): ");
    const ingestMode =
      choice.trim() === "1" ? "shorts" : choice.trim() === "2" ? "videos" : "all";

    const limitInput = await question("Limit per source (default: all): ");
    const parsed = parseInt(limitInput.trim(), 10);
    const maxResults = !Number.isNaN(parsed) && parsed > 0 ? parsed : Infinity;

    const existingMap = await getAllExistingVideos(databases);
    const results = [];

    for (const source of sources) {
      try {
        results.push(await ingestSourceVideos(databases, existingMap, source, maxResults, ingestMode));
      } catch (error) {
        console.error(`Error processing source ${source.youtubeChannelId}: ${error.message}`);
      }
    }

    const totalVideos = results.reduce((sum, item) => sum + item.totalVideos, 0);
    const totalNew = results.reduce((sum, item) => sum + item.newCount, 0);
    const totalUnchanged = results.reduce((sum, item) => sum + item.unchangedCount, 0);
    const totalFiltered = results.reduce((sum, item) => sum + item.filteredCount, 0);
    const totalErrors = results.reduce((sum, item) => sum + item.errorCount, 0);

    console.log("\nSummary:");
    console.log(`Sources processed: ${results.length}`);
    console.log(`Videos discovered: ${totalVideos}`);
    console.log(`New videos added: ${totalNew}`);
    console.log(`Videos unchanged: ${totalUnchanged}`);
    console.log(`Videos filtered: ${totalFiltered}`);
    console.log(`Errors: ${totalErrors}`);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
