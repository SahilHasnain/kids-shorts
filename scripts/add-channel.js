#!/usr/bin/env node

const { Client, Databases, ID, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
require("dotenv").config({ path: envPath });

const config = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: "69d2206900358e41513d",
  channelsCollectionId: "69d22070003313a4fe51",
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

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

async function fetchChannelInfo(channelId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const response = await fetch(
    `${baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${config.youtubeApiKey}`
  );
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const channel = data.items[0];
  return {
    type: "channel",
    youtubeChannelId: channelId,
    name: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
    description: channel.snippet.description || "",
    videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
  };
}

async function fetchPlaylistInfo(playlistId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const response = await fetch(
    `${baseUrl}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${config.youtubeApiKey}`
  );
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`Playlist not found: ${playlistId}`);
  }

  const playlist = data.items[0];
  return {
    type: "playlist",
    youtubeChannelId: playlistId,
    name: playlist.snippet.title,
    thumbnailUrl: playlist.snippet.thumbnails.high?.url || playlist.snippet.thumbnails.default?.url,
    description: playlist.snippet.description || "",
    videoCount: parseInt(playlist.contentDetails?.itemCount || "0", 10),
  };
}

async function sourceExists(databases, youtubeChannelId) {
  const response = await databases.listDocuments(
    config.databaseId,
    config.channelsCollectionId,
    [Query.equal("youtubeChannelId", youtubeChannelId), Query.limit(1)]
  );

  return response.documents.length > 0;
}

async function addSource(databases, sourceInfo) {
  return databases.createDocument(
    config.databaseId,
    config.channelsCollectionId,
    ID.unique(),
    {
      type: sourceInfo.type,
      name: sourceInfo.name,
      youtubeChannelId: sourceInfo.youtubeChannelId,
      thumbnailUrl: sourceInfo.thumbnailUrl,
      description: sourceInfo.description,
      ignoreDuration: false,
      includeShorts: true,
    }
  );
}

async function main() {
  try {
    validateEnv();
    const databases = initAppwrite();

    console.log("What type of source do you want to add?");
    console.log("1. Channel");
    console.log("2. Playlist");
    const typeChoice = await question("Choice (1/2, default: 1): ");

    const sourceType = typeChoice.trim() === "2" ? "playlist" : "channel";
    const sourceId = (
      await question(sourceType === "playlist" ? "Playlist ID: " : "Channel ID: ")
    ).trim();

    if (!sourceId) {
      throw new Error(`${sourceType} ID is required`);
    }

    const sourceInfo =
      sourceType === "playlist"
        ? await fetchPlaylistInfo(sourceId)
        : await fetchChannelInfo(sourceId);

    console.log(`Found ${sourceType}: ${sourceInfo.name}`);
    console.log(`ID: ${sourceInfo.youtubeChannelId}`);
    console.log(`Videos: ${sourceInfo.videoCount}`);

    const exists = await sourceExists(databases, sourceId);
    if (exists) {
      console.log(`This ${sourceType} already exists in the database.`);
    } else {
      const confirm = await question(`Add this ${sourceType} to the database? (y/n): `);
      if (confirm.trim().toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }

      await addSource(databases, sourceInfo);
      console.log(`${sourceType} added successfully.`);
    }

    console.log("Run 'npm run ingest:videos' to ingest content from saved sources.");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
