import { fetchYouTubeChannelInfo, fetchYouTubePlaylistInfo } from "@/lib/channels";
import { appConfig, requireConfig } from "@/lib/config";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    requireConfig();
    const { sourceId, sourceType } = await request.json();

    if (!sourceId || !sourceType) {
      return NextResponse.json(
        { error: "Missing required fields: sourceId and sourceType" },
        { status: 400 }
      );
    }

    const info =
      sourceType === "playlist"
        ? await fetchYouTubePlaylistInfo(sourceId, appConfig.youtubeApiKey)
        : await fetchYouTubeChannelInfo(sourceId, appConfig.youtubeApiKey);

    return NextResponse.json({ info });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch preview" },
      { status: 500 }
    );
  }
}
