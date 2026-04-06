import { getAllChannels } from "@/lib/channels";
import { getAppwriteClient, Query } from "@/lib/appwrite";
import { appConfig } from "@/lib/config";
import { NextResponse } from "next/server";

interface ChannelRecord {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type?: string;
  ignoreDuration?: boolean;
  includeShorts?: boolean;
}

interface VideoRecord {
  isShort?: boolean;
  videoId?: string | null;
}

async function getStorageFileCount() {
  const { storage } = getAppwriteClient();
  let total = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await storage.listFiles(appConfig.storageBucketId, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    total += response.files.length;

    if (response.files.length < limit) {
      break;
    }

    offset += limit;
  }

  return total;
}

export async function GET() {
  try {
    const { databases } = getAppwriteClient();
    const channels = await getAllChannels();
    const videoFilesCount = await getStorageFileCount();
    const channelStats = await Promise.all(
      (channels as ChannelRecord[]).map(async (channel) => {
        const response = await databases.listDocuments(appConfig.databaseId, appConfig.videosCollectionId, [
          Query.equal("channelId", channel.youtubeChannelId),
          Query.limit(5000),
        ]);

        const totalCount = response.total;
        const documents = response.documents as unknown as VideoRecord[];
        const shortsCount = documents.filter((video) => video.isShort).length;
        const videosCount = totalCount - shortsCount;
        const fileCount = documents.filter((video) => Boolean(video.videoId)).length;

        return {
          $id: channel.$id,
          name: channel.name,
          youtubeChannelId: channel.youtubeChannelId,
          type: channel.type || "channel",
          ignoreDuration: channel.ignoreDuration || false,
          includeShorts: channel.includeShorts || false,
          totalCount,
          speechesOnlyCount: videosCount,
          shortsCount,
          videoCount: fileCount,
        };
      })
    );

    const totalDocuments = channelStats.reduce((sum, channel) => sum + channel.totalCount, 0);
    const totalVideos = channelStats.reduce((sum, channel) => sum + channel.speechesOnlyCount, 0);
    const totalShorts = channelStats.reduce((sum, channel) => sum + channel.shortsCount, 0);

    channelStats.sort((a, b) => b.totalCount - a.totalCount);

    return NextResponse.json({
      stats: {
        totalDocuments,
        totalSpeeches: totalVideos,
        totalShorts,
        channelsCount: channels.length,
        videoFilesCount,
      },
      channels: channelStats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch database stats" },
      { status: 500 }
    );
  }
}
