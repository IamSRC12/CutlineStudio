import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, assets } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { runFullAlignment } from "@/lib/align/reconcile";
import { transcribeAudioWithGroq } from "@/lib/asr/groq";
import { WhisperWord } from "@/shared/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const lyricsOverride = body.lyrics as string | undefined;

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    // Set status to aligning
    await db.update(projects).set({ status: "aligning" }).where(eq(projects.id, projectId));

    // Get mix asset
    const [mixAsset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.kind, "mix")))
      .limit(1);

    const trackDurationSec = mixAsset?.durationSec || 30.0;
    const sampleRate = mixAsset?.sampleRate || 44100;

    // Get current document
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.version))
      .limit(1);

    const lyricsText = lyricsOverride ?? existingDoc?.lyricsOriginal ?? "";
    let whisperWords: WhisperWord[] = existingDoc?.wordsJson || [];

    // If no words yet, run transcribe first
    if (whisperWords.length === 0 && mixAsset) {
      const transcribeRes = await transcribeAudioWithGroq({
        filePath: mixAsset.storagePath,
        language: project.settingsJson.language,
        durationSec: trackDurationSec,
      });
      whisperWords = transcribeRes.words;
    }

    // Run Full Alignment Pipeline
    const alignmentResult = await runFullAlignment({
      lyricsOriginal: lyricsText,
      whisperWords,
      trackDurationSec,
      sampleRate,
      audioPcm: null, // Server uses metadata-guided polish; client does fine-grain zero-crossing
      settings: project.settingsJson,
    });

    // Update document
    const newVersion = (existingDoc?.version || 1) + 1;

    if (existingDoc) {
      await db
        .update(documents)
        .set({
          version: newVersion,
          lyricsOriginal: lyricsText,
          linesJson: alignmentResult.lines,
          regionsJson: alignmentResult.regions,
          wordsJson: alignmentResult.words,
          alignmentJson: alignmentResult.alignmentTrace,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, existingDoc.id));
    }

    // Update project status to ready
    await db.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId));

    return NextResponse.json({
      success: true,
      lines: alignmentResult.lines,
      regions: alignmentResult.regions,
      words: alignmentResult.words,
      alignmentTrace: alignmentResult.alignmentTrace,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Alignment failed";
    console.error("Alignment route error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
