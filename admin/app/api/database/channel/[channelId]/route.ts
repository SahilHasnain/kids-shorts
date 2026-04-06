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
  duration?: number;
  isShort?: boolean;
  videoId?: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const { databases } = getAppwriteClient();
    const channels = await getAllChannels();
    const channel = (channels as ChannelRecord[]).find((item) => item.youtubeChannelId === channelId);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const response = await databases.listDocuments(appConfig.databaseId, appConfig.videosCollectionId, [
      Query.equal("channelId", channelId),
      Query.limit(5000),
    ]);

    const documents = response.documents as unknown as VideoRecord[];
    const total = documents.length;
    const shorts = documents.filter((video) => video.isShort).length;
    const videos = total - shorts;
    const withFiles = documents.filter((video) => Boolean(video.videoId));
    const speechVideoCount = withFiles.filter((video) => !video.isShort).length;
    const shortVideoCount = withFiles.filter((video) => video.isShort).length;
    const totalDuration = documents.reduce((sum, video) => sum + (video.duration || 0), 0);
    const durations = documents.map((video) => video.duration || 0);

    return NextResponse.json({
      $id: channel.$id,
      name: channel.name,
      youtubeChannelId: channel.youtubeChannelId,
      type: channel.type || "channel",
      ignoreDuration: channel.ignoreDuration || false,
      includeShorts: channel.includeShorts || false,
      totalCount: total,
      speechesOnlyCount: videos,
      shortsCount: shorts,
      videoCount: withFiles.length,
      total,
      speechesOnly: videos,
      shorts,
      speechVideoCount,
      shortVideoCount,
      under20Min: documents.filter((video) => (video.duration || 0) < 1200).length,
      over20Min: documents.filter((video) => (video.duration || 0) >= 1200).length,
      totalDuration,
      avgDuration: total > 0 ? totalDuration / total : 0,
      maxDuration: total > 0 ? Math.max(...durations) : 0,
      minDuration: total > 0 ? Math.min(...durations) : 0,
      documentsWithoutVideo: total - withFiles.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch channel details" },
      { status: 500 }
    );
  }
}
