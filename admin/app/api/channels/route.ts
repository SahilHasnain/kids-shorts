import { getAllChannels } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ channels: await getAllChannels() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch channels" },
      { status: 500 }
    );
  }
}
