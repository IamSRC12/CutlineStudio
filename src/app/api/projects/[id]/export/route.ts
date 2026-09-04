import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, assets } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createProjectZip } from "@/lib/export/zip";
import fs from "fs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const [documentRow] = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.version))
      .limit(1);

    if (!documentRow) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    const [mixAsset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.kind, "mix")))
      .limit(1);

    if (!mixAsset || !fs.existsSync(mixAsset.storagePath)) {
      return NextResponse.json({ success: false, error: "Audio mix asset not found" }, { status: 404 });
    }

    // Read audio buffer
    const fileBuffer = fs.readFileSync(mixAsset.storagePath);
    const sampleRate = mixAsset.sampleRate || 44100;
    const durationSec = mixAsset.durationSec || 30.0;
    const numSamples = Math.round(sampleRate * durationSec);

    // Simple PCM float decoding from 16-bit WAV (skip 44 byte header if standard wav)
    let left = new Float32Array(numSamples);
    let right = new Float32Array(numSamples);

    if (mixAsset.mime.includes("wav") && fileBuffer.length > 44) {
      const dataOffset = 44;
      const totalBytes = fileBuffer.length - dataOffset;
      const channels = mixAsset.channels || 2;
      const sampleCount = Math.floor(totalBytes / (2 * channels));
      left = new Float32Array(sampleCount);
      right = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        const offset = dataOffset + i * channels * 2;
        const lVal = fileBuffer.readInt16LE(offset) / 32768.0;
        left[i] = lVal;
        if (channels > 1) {
          const rVal = fileBuffer.readInt16LE(offset + 2) / 32768.0;
          right[i] = rVal;
        } else {
          right[i] = lVal;
        }
      }
    }

    const document = {
      id: documentRow.id,
      projectId: documentRow.projectId,
      version: documentRow.version,
      lyricsOriginal: documentRow.lyricsOriginal,
      lines: documentRow.linesJson,
      regions: documentRow.regionsJson,
      words: documentRow.wordsJson,
    };

    const zipBytes = createProjectZip({
      project: {
        id: project.id,
        title: project.title,
        status: project.status as "draft" | "ingesting" | "transcribing" | "aligning" | "ready" | "error",
        settings: project.settingsJson,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      document,
      audioChannels: [left, right],
      sampleRate,
      durationSec,
      normalize: project.settingsJson.normalizeClips,
    });

    const safeTitle = project.title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "lyricsplit_export";
    const filename = `${safeTitle}_clips.zip`;

    return new NextResponse(zipBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBytes.byteLength),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    console.error("Export error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
