import { deleteChannel } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const { youtubeChannelId } = await request.json();
    if (!youtubeChannelId) {
      return NextResponse.json({ error: "youtubeChannelId is required" }, { status: 400 });
    }

    const result = await deleteChannel(youtubeChannelId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete channel" },
      { status: 500 }
    );
  }
}
