import { describe, it, expect } from "vitest";
import { createFallbackDb } from "@/db/fallback-db";
import { projects, assets } from "@/db/schema";
import { eq, and } from "drizzle-orm";

describe("Fallback Database Engine", () => {
  it("inserts and filters records accurately with eq() and and()", async () => {
    const db = createFallbackDb();
    const testId = `test_proj_${Date.now()}`;

    // 1. Insert
    await db.insert(projects).values({
      id: testId,
      title: "Test Project",
      status: "draft",
      settingsJson: {
        language: "en",
        preRollMs: 40,
        postRollMs: 80,
        minInstrumentalMs: 250,
        absorbPolicy: "previous",
      },
    });

    // 2. Select with eq()
    const [found] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, testId))
      .limit(1);

    expect(found).toBeDefined();
    expect(found?.id).toBe(testId);
    expect(found?.title).toBe("Test Project");

    // 3. Select non-existent id
    const [nonExistent] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, "non_existent_random_id"))
      .limit(1);

    expect(nonExistent).toBeUndefined();

    // 4. Insert asset and select with compound and()
    const assetId = `test_asset_${Date.now()}`;
    await db.insert(assets).values({
      id: assetId,
      projectId: testId,
      kind: "mix",
      filename: "test.wav",
      mime: "audio/wav",
      bytes: 1024,
      sha256: "dummy_sha256",
      durationSec: 10,
      sampleRate: 44100,
      channels: 2,
      storagePath: "/tmp/test.wav",
    });

    const [mixAsset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, testId), eq(assets.kind, "mix")))
      .limit(1);

    expect(mixAsset).toBeDefined();
    expect(mixAsset?.id).toBe(assetId);

    const [instAsset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, testId), eq(assets.kind, "instrumental")))
      .limit(1);

    expect(instAsset).toBeUndefined();

    // Cleanup
    await db.delete(assets).where(eq(assets.id, assetId));
    await db.delete(projects).where(eq(projects.id, testId));
  });
});
