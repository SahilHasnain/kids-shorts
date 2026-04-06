import { cleanupOrphanedSpeeches } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json(await cleanupOrphanedSpeeches());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cleanup orphaned videos" },
      { status: 500 }
    );
  }
}
