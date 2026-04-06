import {
  addChannel,
  fetchYouTubeChannelInfo,
  fetchYouTubePlaylistInfo,
  type ChannelInfo,
} from "@/lib/channels";
import { appConfig, requireConfig } from "@/lib/config";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    requireConfig();
    const body = await request.json();
    const { sourceId, sourceType, ignoreDuration, includeShorts } = body;

    if (!sourceId || !sourceType) {
      return NextResponse.json(
        { error: "Missing required fields: sourceId and sourceType" },
        { status: 400 }
      );
    }

    const info: ChannelInfo =
      sourceType === "playlist"
        ? await fetchYouTubePlaylistInfo(sourceId, appConfig.youtubeApiKey)
        : await fetchYouTubeChannelInfo(sourceId, appConfig.youtubeApiKey);

    info.ignoreDuration = Boolean(ignoreDuration);
    info.includeShorts = includeShorts ?? true;

    const result = await addChannel(info);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, channel: result.channel, info });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add channel" },
      { status: 500 }
    );
  }
}
