import { IngestConfig, ingestSpeeches } from "@/lib/speech-ingest";
import { NextRequest } from "next/server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: IngestConfig = {
      channels: body.channels || [],
      ingestMode: body.ingestMode || "all",
      limit: body.limit || null,
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
          const results = await ingestSpeeches(config, (data) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "complete", results })}\n\n`)
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: error instanceof Error ? error.message : "Ingestion failed",
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
        error: error instanceof Error ? error.message : "Failed to start ingestion",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
