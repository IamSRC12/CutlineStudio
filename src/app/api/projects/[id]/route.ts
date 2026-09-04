import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, documents, assets } from "@/db/schema";
import { projectSettingsSchema, Document } from "@/shared/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const [documentRow] = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, id))
      .orderBy(desc(documents.version))
      .limit(1);

    const projectAssets = await db.select().from(assets).where(eq(assets.projectId, id));

    const document: Document = {
      id: documentRow?.id || `doc_${id}`,
      projectId: id,
      version: documentRow?.version || 1,
      lyricsOriginal: documentRow?.lyricsOriginal || "",
      lines: documentRow?.linesJson || [],
      regions: documentRow?.regionsJson || [],
      words: documentRow?.wordsJson || [],
      alignmentTrace: (documentRow?.alignmentJson as Document["alignmentTrace"]) || {},
      updatedAt: documentRow?.updatedAt?.toISOString(),
    };

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        settings: project.settingsJson,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      document,
      assets: projectAssets,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load project";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updates.title = body.title;
    }

    if (body.status !== undefined) {
      updates.status = body.status;
    }

    if (body.settings !== undefined) {
      const parsedSettings = projectSettingsSchema.partial().parse(body.settings);
      // Fetch current settings
      const [current] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (current) {
        updates.settingsJson = {
          ...current.settingsJson,
          ...parsedSettings,
        };
      }
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    return NextResponse.json({ success: true, project: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
