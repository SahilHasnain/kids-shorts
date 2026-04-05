#!/usr/bin/env node

/**
 * Interactive CLI Tool to Add Kids Channels
 *
 * This tool:
 * 1. Prompts for YouTube channel ID
 * 2. Fetches channel info from YouTube
 * 3. Adds channel to Appwrite Channels collection with isKidsChannel=true
 * 4. Optionally runs ingestion for that channel
 *
 * Usage: node scripts/add-channel.js
 */

const { Client, Databases, ID, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = path.join(__dirname, "..", ".env.local");
require("dotenv").config({ path: envPath });

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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Validate environment
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
    process.exit(1);
  }
}

// Initialize Appwrite
function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return new Databases(client);
}

// Fetch channel info from YouTube
async function fetchChannelInfo(channelId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const response = await fetch(
      `${baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${config.youtubeApiKey}`,
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
      youtubeChannelId: channelId,
      name: channel.snippet.title,
      description: channel.snippet.description || "",
      subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
      videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
    };
  } catch (error) {
    throw new Error(`Failed to fetch channel info: ${error.message}`);
  }
}

// Check if channel already exists
async function channelExists(databases, youtubeChannelId) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("youtubeChannelId", youtubeChannelId), Query.limit(1)],
    );

    return response.documents.length > 0;
  } catch (error) {
    throw new Error(`Failed to check channel existence: ${error.message}`);
  }
}

// Add channel to database
async function addChannel(databases, channelInfo) {
  try {
    const document = await databases.createDocument(
      config.databaseId,
      config.channelsCollectionId,
      ID.unique(),
      {
        name: channelInfo.name,
        youtubeChannelId: channelInfo.youtubeChannelId,
        isKidsChannel: true,
      },
    );

    return document;
  } catch (error) {
    throw new Error(`Failed to add channel: ${error.message}`);
  }
}

// Main CLI function
async function main() {
  console.log("🎨 Kids Shorts - Add Channel Tool\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const databases = initAppwrite();

    console.log("📝 Enter YouTube Channel ID:");
    console.log("   (e.g., UCDwHEBKDyZvCbHLjNh8olfQ)\n");

    const channelId = await question("Channel ID: ");

    if (!channelId || !channelId.trim()) {
      console.error("\n❌ Channel ID is required");
      rl.close();
      process.exit(1);
    }

    const trimmedChannelId = channelId.trim();

    console.log(`\n🔍 Fetching channel information from YouTube...`);
    const channelInfo = await fetchChannelInfo(trimmedChannelId);

    console.log(`\n✅ Channel found!`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📺 Name: ${channelInfo.name}`);
    console.log(`🆔 ID: ${channelInfo.youtubeChannelId}`);
    console.log(`📹 Videos: ${channelInfo.videoCount.toLocaleString()}`);
    console.log(`👥 Subscribers: ${channelInfo.subscriberCount.toLocaleString()}`);
    console.log(`📝 Description: ${channelInfo.description.substring(0, 100)}...`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Check if channel already exists
    const exists = await channelExists(databases, trimmedChannelId);

    if (exists) {
      console.log(`ℹ️  This channel already exists in the database.`);
      console.log("   You can proceed with ingestion if needed.\n");
    } else {
      // Confirm adding channel
      const confirm = await question(`Add this channel to the database? (y/n): `);

      if (confirm.toLowerCase() !== "y") {
        console.log("\n👋 Cancelled. Goodbye!");
        rl.close();
        process.exit(0);
      }

      console.log(`\n💾 Adding channel to database...`);
      await addChannel(databases, channelInfo);
      console.log(`✅ Channel added successfully!`);
    }

    console.log(`\n✅ Channel ready! Run 'npm run ingest:videos' to ingest videos.`);
    console.log("\n👋 Done! Goodbye!");
    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run CLI
main();
