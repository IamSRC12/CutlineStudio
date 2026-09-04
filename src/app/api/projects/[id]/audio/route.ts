import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const kind = req.nextUrl.searchParams.get("kind") || "mix";

    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.kind, kind)))
      .limit(1);

    if (!asset || !fs.existsSync(asset.storagePath)) {
      return new NextResponse("Audio file not found", { status: 404 });
    }

    const stat = fs.statSync(asset.storagePath);
    const fileSize = stat.size;
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(asset.storagePath, { start, end });

      // Convert Node readable stream to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunksize),
          "Content-Type": asset.mime || "audio/wav",
        },
      });
    }

    const fileStream = fs.createReadStream(asset.storagePath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": asset.mime || "audio/wav",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to stream audio";
    return new NextResponse(message, { status: 500 });
  }
}
