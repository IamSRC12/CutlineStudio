import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, assets } from "@/db/schema";
import { projectSettingsSchema, Project } from "@/shared/schema";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { generateDemoSongWav } from "@/lib/audio/demo-audio";
import { getAssetPath, calculateSha256 } from "@/lib/audio/storage";
import fs from "fs";

export async function GET() {
  try {
    const list = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(50);
    return NextResponse.json({ success: true, projects: list });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch projects";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title = "Untitled Project",
      lyrics = "",
      settings = {},
      useDemoSong = false,
    } = body;

    const validatedSettings = projectSettingsSchema.parse(settings);
    const projectId = `proj_${crypto.randomBytes(8).toString("hex")}`;
    const docId = `doc_${crypto.randomBytes(8).toString("hex")}`;

    // Create project record
    const [projectRow] = await db
      .insert(projects)
      .values({
        id: projectId,
        title: title || "Untitled Track",
        status: useDemoSong ? "ingesting" : "draft",
        settingsJson: validatedSettings,
      })
      .returning();

    // Create initial document
    await db.insert(documents).values({
      id: docId,
      projectId,
      version: 1,
      lyricsOriginal: lyrics || "",
      linesJson: [],
      regionsJson: [],
      wordsJson: [],
      alignmentJson: {},
    });

    // If demo song requested, synthesize and attach demo asset
    if (useDemoSong) {
      const demoWav = generateDemoSongWav(44100);
      const assetId = `asset_${crypto.randomBytes(8).toString("hex")}`;
      const storagePath = getAssetPath(assetId, ".wav");
      const buffer = Buffer.from(demoWav);

      fs.writeFileSync(storagePath, buffer);
      const sha256 = calculateSha256(buffer);

      await db.insert(assets).values({
        id: assetId,
        projectId,
        kind: "mix",
        filename: "city_lights_demo.wav",
        mime: "audio/wav",
        bytes: buffer.length,
        sha256,
        durationSec: 20.0,
        sampleRate: 44100,
        channels: 2,
        storagePath,
      });

      // Update project status to ready for alignment
      await db
        .update(projects)
        .set({ status: "draft" })
        .where(eq(projects.id, projectId));
    }

    return NextResponse.json({
      success: true,
      project: projectRow,
      projectId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    console.error("Create project error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
