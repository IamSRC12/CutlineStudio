import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, assets, asrJobs, documents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { transcribeAudioWithGroq } from "@/lib/asr/groq";
import crypto from "crypto";

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

    // Get mix asset
    const [mixAsset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.kind, "mix")))
      .limit(1);

    if (!mixAsset) {
      return NextResponse.json({ success: false, error: "No audio file uploaded for this project" }, { status: 400 });
    }

    // Update status to transcribing
    await db.update(projects).set({ status: "transcribing" }).where(eq(projects.id, projectId));

    // Check ASR cache
    const paramsHash = crypto
      .createHash("sha256")
      .update(`${mixAsset.sha256}_whisper-large-v3-turbo_${project.settingsJson.language || "auto"}`)
      .digest("hex");

    const [cachedJob] = await db
      .select()
      .from(asrJobs)
      .where(eq(asrJobs.paramsHash, paramsHash))
      .limit(1);

    let transcribeResult;

    if (cachedJob && cachedJob.rawJson) {
      const raw = cachedJob.rawJson as {
        text: string;
        words: Array<{ id: string; word: string; start: number; end: number; confidence?: number; segmentId?: number }>;
        segments: Array<{ id: number; start: number; end: number; text: string }>;
      };
      transcribeResult = {
        text: raw.text || "",
        words: (raw.words || []).map((w) => ({
          id: w.id,
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence ?? 1.0,
          segmentId: w.segmentId,
        })),
        segments: raw.segments || [],
        raw,
        cached: true,
      };
    } else {
      transcribeResult = await transcribeAudioWithGroq({
        filePath: mixAsset.storagePath,
        language: project.settingsJson.language,
        durationSec: mixAsset.durationSec,
      });

      // Save to ASR cache
      const asrJobId = `asr_${crypto.randomBytes(8).toString("hex")}`;
      await db.insert(asrJobs).values({
        id: asrJobId,
        assetId: mixAsset.id,
        model: "whisper-large-v3-turbo",
        paramsHash,
        rawJson: transcribeResult,
        status: "completed",
      });
    }

    // Update latest document with words
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.version))
      .limit(1);

    if (existingDoc) {
      await db
        .update(documents)
        .set({
          wordsJson: transcribeResult.words,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, existingDoc.id));
    }

    // Set project status to ready
    await db.update(projects).set({ status: "draft" }).where(eq(projects.id, projectId));

    return NextResponse.json({
      success: true,
      words: transcribeResult.words,
      cached: transcribeResult.cached ?? false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ASR transcription failed";
    console.error("Transcribe error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
