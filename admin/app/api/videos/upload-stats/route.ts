import { getAllChannels } from "@/lib/channels";
import { getAppwriteClient, Query } from "@/lib/appwrite";
import { appConfig } from "@/lib/config";
import { NextResponse } from "next/server";

interface ChannelRecord {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type?: string;
}

interface VideoRecord {
  duration: number;
}

export async function GET() {
  try {
    const { databases } = getAppwriteClient();
    const channels = await getAllChannels();
    const allVideos: VideoRecord[] = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(appConfig.databaseId, appConfig.videosCollectionId, [
        Query.isNull("videoId"),
        Query.limit(limit),
        Query.offset(offset),
      ]);

      allVideos.push(...(response.documents as unknown as VideoRecord[]));

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    const shortsWithoutVideo = allVideos.filter((video) => video.duration < 60).length;
    const videosWithoutVideo = allVideos.filter((video) => video.duration >= 60).length;

    return NextResponse.json({
      channels: (channels as ChannelRecord[]).map((channel) => ({
        $id: channel.$id,
        name: channel.name,
        youtubeChannelId: channel.youtubeChannelId,
        type: channel.type || "channel",
      })),
      stats: {
        totalWithoutVideo: allVideos.length,
        shortsWithoutVideo,
        speechesWithoutVideo: videosWithoutVideo,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch upload stats" },
      { status: 500 }
    );
  }
}
