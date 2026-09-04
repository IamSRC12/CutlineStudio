import { describe, it, expect } from "vitest";
import { documentSchema, Document } from "@/shared/schema";

describe("Document Schema & Version Migration", () => {
  it("migrates a v1 document fixture with missing fields to v2 specification", () => {
    // Legacy v1 document payload with minimal fields
    const v1Fixture = {
      id: "doc_legacy_123",
      projectId: "proj_123",
      version: 1,
      lyricsOriginal: "Hello world",
      lines: [
        {
          id: "line_0",
          index: 0,
          text: "Hello world",
          wordIds: ["w_0", "w_1"],
          startRaw: 1.0,
          endRaw: 2.5,
          start: 0.96,
          end: 2.58,
          confidence: 0.95,
          status: "ok",
        },
      ],
      regions: [
        {
          id: "r_0",
          index: 0,
          kind: "line",
          lineId: "line_0",
          start: 0.96,
          end: 2.58,
          skip: false,
          label: "00_line_01_hello_world",
        },
      ],
      words: [
        { id: "w_0", word: "Hello", start: 1.0, end: 1.5 },
        { id: "w_1", word: "world", start: 1.6, end: 2.5 },
      ],
    };

    // Parse and validate with Zod
    const parsed = documentSchema.parse(v1Fixture);

    expect(parsed.id).toBe("doc_legacy_123");
    expect(parsed.version).toBe(1);
    expect(parsed.lines[0].inferredRepeat).toBe(false);
    expect(parsed.regions[0].kind).toBe("line");

    // Upgrade migration to v2
    const v2Document: Document = {
      ...parsed,
      version: 2,
      updatedAt: new Date().toISOString(),
    };

    expect(v2Document.version).toBe(2);
    expect(documentSchema.safeParse(v2Document).success).toBe(true);
  });
});
