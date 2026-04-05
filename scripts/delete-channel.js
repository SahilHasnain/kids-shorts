#!/usr/bin/env node

/**
 * Delete Channel and Associated Videos Script
 *
 * This tool:
 * 1. Prompts for channel document ID
 * 2. Fetches channel information
 * 3. Finds all videos belonging to that channel
 * 4. Deletes all videos
 * 5. Deletes the channel document
 *
 * Usage: node scripts/delete-channel.js
 */

const { Client, Databases, Storage, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");

// Load environment variables
const envPath = path.join(__dirname, "..", ".env.local");
require("dotenv").config({ path: envPath });

// Configuration
const config = {
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: "69d2206900358e41513d",
  videosCollectionId: "69d2206b0018425b9cb5",
  channelsCollectionId: "69d22070003313a4fe51",
  videoBucketId: "69d22086002f376ddbb3",
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

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

// Get channel by document ID
async function getChannelById(databases, channelDocId) {
  try {
    const channel = await databases.getDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelDocId,
    );
    return channel;
  } catch (error) {
    if (error.code === 404) {
      throw new Error(`Channel not found with ID: ${channelDocId}`);
    }
    throw new Error(`Failed to fetch channel: ${error.message}`);
  }
}

// List all channels
async function listAllChannels(databases) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("isKidsChannel", true), Query.limit(100)],
    );
    return response.documents;
  } catch (error) {
    throw new Error(`Failed to list channels: ${error.message}`);
  }
}

// Get all videos for a channel
async function getVideosByChannel(databases, youtubeChannelId) {
  try {
    const allVideos = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.videosCollectionId,
        [
          Query.equal("channelId", youtubeChannelId),
          Query.limit(limit),
          Query.offset(offset),
        ],
      );

      allVideos.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    return allVideos;
  } catch (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }
}

// Delete video file from storage
async function deleteVideoFile(storage, videoId) {
  try {
    await storage.deleteFile(config.videoBucketId, videoId);
    return true;
  } catch (error) {
    // File might not exist or already deleted
    if (error.code === 404) {
      return false; // File not found
    }
    throw new Error(`Failed to delete video file ${videoId}: ${error.message}`);
  }
}

// Delete a video document and its associated file
async function deleteVideo(databases, storage, video) {
  try {
    // Delete video file if it exists
    let videoDeleted = false;
    if (video.videoId) {
      try {
        videoDeleted = await deleteVideoFile(storage, video.videoId);
      } catch (error) {
        console.error(`   ⚠️  Warning: Could not delete video file for ${video.title}: ${error.message}`);
      }
    }

    // Delete video document
    await databases.deleteDocument(
      config.databaseId,
      config.videosCollectionId,
      video.$id,
    );

    return { videoDeleted };
  } catch (error) {
    throw new Error(`Failed to delete video ${video.$id}: ${error.message}`);
  }
}

// Delete channel document
async function deleteChannel(databases, channelDocId) {
  try {
    await databases.deleteDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelDocId,
    );
  } catch (error) {
    throw new Error(`Failed to delete channel: ${error.message}`);
  }
}

// Main CLI function
async function main() {
  console.log("🗑️  Kids Shorts - Delete Channel Tool\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const { databases, storage } = initAppwrite();

    // List all channels first
    console.log("📋 Fetching all kids channels...\n");
    const channels = await listAllChannels(databases);

    if (channels.length === 0) {
      console.log("⚠️  No kids channels found in the database.");
      rl.close();
      process.exit(0);
    }

    console.log("Available channels:");
    console.log("═══════════════════════════════════════════════════════════");
    channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.name}`);
      console.log(`   Document ID: ${channel.$id}`);
      console.log(`   YouTube ID: ${channel.youtubeChannelId}`);
      console.log("");
    });
    console.log("═══════════════════════════════════════════════════════════\n");

    // Prompt for channel document ID
    console.log("📝 Enter the Channel Document ID to delete:");
    console.log("   (Copy the Document ID from the list above)\n");

    const channelDocId = await question("Channel Document ID: ");

    if (!channelDocId || !channelDocId.trim()) {
      console.error("\n❌ Channel Document ID is required");
      rl.close();
      process.exit(1);
    }

    const trimmedChannelDocId = channelDocId.trim();

    console.log(`\n🔍 Fetching channel information...`);

    // Fetch channel info
    const channel = await getChannelById(databases, trimmedChannelDocId);

    console.log("\n✅ Channel found!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📺 Name: ${channel.name}`);
    console.log(`🆔 Document ID: ${channel.$id}`);
    console.log(`🆔 YouTube Channel ID: ${channel.youtubeChannelId}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Fetch videos for this channel
    console.log("🔍 Searching for videos from this channel...");
    const videos = await getVideosByChannel(databases, channel.youtubeChannelId);

    console.log(`✅ Found ${videos.length} video(s) from this channel\n`);

    if (videos.length > 0) {
      const shorts = videos.filter(v => v.isShort);
      const regularVideos = videos.filter(v => !v.isShort);
      
      console.log("📋 Videos to be deleted:");
      console.log("───────────────────────────────────────────────────────────");
      console.log(`   Shorts: ${shorts.length}`);
      console.log(`   Regular videos: ${regularVideos.length}`);
      console.log(`   Total: ${videos.length}`);
      console.log("───────────────────────────────────────────────────────────");
      
      videos.slice(0, 10).forEach((video, index) => {
        const type = video.isShort ? "[SHORT]" : "[VIDEO]";
        console.log(`${index + 1}. ${type} ${video.title}`);
      });
      if (videos.length > 10) {
        console.log(`   ... and ${videos.length - 10} more`);
      }
      console.log("───────────────────────────────────────────────────────────\n");
    }

    // Confirm deletion
    console.log("⚠️  WARNING: This action cannot be undone!");
    console.log(`   - ${videos.length} video(s) will be deleted`);
    console.log(`   - Associated video files will be deleted from storage`);
    console.log(`   - Channel "${channel.name}" can optionally be deleted\n`);

    const confirm = await question("Are you sure you want to delete videos? Type 'DELETE' to confirm: ");

    if (confirm !== "DELETE") {
      console.log("\n👋 Deletion cancelled. Goodbye!");
      rl.close();
      process.exit(0);
    }

    // Delete videos
    if (videos.length > 0) {
      console.log("\n🗑️  Deleting videos and associated files...");

      let deletedCount = 0;
      let errorCount = 0;
      let filesDeletedCount = 0;
      let filesNotFoundCount = 0;

      for (const video of videos) {
        try {
          const { videoDeleted } = await deleteVideo(databases, storage, video);
          deletedCount++;
          if (videoDeleted) {
            filesDeletedCount++;
            console.log(`   ✅ Deleted: ${video.title} (+ video file)`);
          } else {
            filesNotFoundCount++;
            console.log(`   ✅ Deleted: ${video.title} (no video file found)`);
          }
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error deleting ${video.title}: ${error.message}`);
        }
      }

      console.log("\n═══════════════════════════════════════════════════════════");
      console.log("📊 Video Deletion Summary:");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`   ✅ Videos deleted: ${deletedCount}`);
      console.log(`   🎥 Video files deleted: ${filesDeletedCount}`);
      console.log(`   ℹ️  Video files not found: ${filesNotFoundCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log("═══════════════════════════════════════════════════════════\n");
    }

    // Ask if user wants to delete the channel document
    console.log("📋 Do you also want to delete the channel document?");
    console.log(`   Channel: "${channel.name}"`);
    console.log("   Note: Deleting the channel will remove it from your sources list.\n");

    const deleteChannelConfirm = await question("Delete channel document? (y/n): ");

    if (deleteChannelConfirm.toLowerCase() === "y") {
      console.log("\n🗑️  Deleting channel...");
      await deleteChannel(databases, trimmedChannelDocId);
      console.log(`✅ Channel "${channel.name}" deleted successfully!\n`);
    } else {
      console.log(`\n✅ Channel "${channel.name}" kept in database.\n`);
    }

    console.log("✨ Deletion complete!");
    console.log("👋 Goodbye!");
    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run CLI
main();
