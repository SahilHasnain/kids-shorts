import { UploadConfig, uploadVideos } from "@/lib/video-upload";
import { NextRequest } from "next/server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: UploadConfig = {
      channels: body.channels || [],
      uploadMode: body.uploadMode || "all",
      quality: body.quality || 720,
      limit: body.limit || 10,
    };

    if (config.channels.length === 0) {
      return new Response(JSON.stringify({ error: "At least one channel must be selected" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await uploadVideos(config, (data) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "complete", result })}\n\n`)
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: error instanceof Error ? error.message : "Upload failed",
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to start upload",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
