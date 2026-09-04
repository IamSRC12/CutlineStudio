import { describe, it, expect } from "vitest";
import { buildRegions } from "@/lib/align/region-builder";
import { Line, ProjectSettings } from "@/shared/schema";

describe("Region Builder Canonical 5-Line Test", () => {
  const defaultSettings: ProjectSettings = {
    preRollMs: 40,
    postRollMs: 80,
    minInstrumentalMs: 250, // 0.25s
    absorbPolicy: "previous",
    boundarySearchMs: 80,
    includeSkipped: false,
    exportFormat: "wav",
    normalizeClips: false,
    keepAdlibsInLine: true,
    spokenAsInstrumental: true,
  };

  it("produces exactly 8 regions (00_intro to 07_outro) for 4 lyric lines with intro, 2 breaks, and outro", () => {
    // 4 lines with 2 breaks:
    // 00_instrumental_intro.wav (0.0 - 2.0)
    // 01_line_01.wav            (2.0 - 5.0)
    // 02_instrumental_gap.wav   (5.0 - 6.5) [Break 1]
    // 03_line_02.wav            (6.5 - 9.5)
    // 04_line_03.wav            (9.5 - 12.0) [Contiguous with Line 2]
    // 05_instrumental_gap.wav   (12.0 - 14.0) [Break 2]
    // 06_line_04.wav            (14.0 - 17.0)
    // 07_instrumental_outro.wav (17.0 - 20.0)
    const lines: Line[] = [
      {
        id: "l1",
        index: 0,
        text: "Yeah",
        wordIds: ["w1"],
        startRaw: 2.0,
        endRaw: 5.0,
        start: 2.0,
        end: 5.0,
        confidence: 1.0,
        status: "ok",
        inferredRepeat: false,
      },
      {
        id: "l2",
        index: 1,
        text: "Welcome to the sound of the city",
        wordIds: ["w2"],
        startRaw: 6.5,
        endRaw: 9.5,
        start: 6.5,
        end: 9.5,
        confidence: 1.0,
        status: "ok",
        inferredRepeat: false,
      },
      {
        id: "l3",
        index: 2,
        text: "Neon lights are shining bright",
        wordIds: ["w3"],
        startRaw: 9.5,
        endRaw: 12.0,
        start: 9.5,
        end: 12.0,
        confidence: 1.0,
        status: "ok",
        inferredRepeat: false,
      },
      {
        id: "l4",
        index: 3,
        text: "Walking through the midnight air",
        wordIds: ["w4"],
        startRaw: 14.0,
        endRaw: 17.0,
        start: 14.0,
        end: 17.0,
        confidence: 1.0,
        status: "ok",
        inferredRepeat: false,
      },
    ];

    const regions = buildRegions({
      lines,
      trackDurationSec: 20.0,
      sampleRate: 44100,
      settings: defaultSettings,
    });

    expect(regions.length).toBe(8);

    expect(regions[0].kind).toBe("instrumental_intro");
    expect(regions[1].kind).toBe("line");
    expect(regions[2].kind).toBe("instrumental_gap");
    expect(regions[3].kind).toBe("line");
    expect(regions[4].kind).toBe("line");
    expect(regions[5].kind).toBe("instrumental_gap");
    expect(regions[6].kind).toBe("line");
    expect(regions[7].kind).toBe("instrumental_outro");

    expect(regions[0].label).toContain("00_instrumental_intro");
    expect(regions[7].label).toContain("07_instrumental_outro");

    for (let i = 0; i < regions.length - 1; i++) {
      expect(regions[i].end).toBeLessThanOrEqual(regions[i + 1].start);
    }
  });

  it("absorbs tiny 80ms gap below minInstrumentalMs threshold into previous line", () => {
    const lines: Line[] = [
      {
        id: "l1",
        index: 0,
        text: "Line One",
        wordIds: ["w1"],
        startRaw: 1.0,
        endRaw: 3.0,
        start: 1.0,
        end: 3.0,
        confidence: 1.0,
        status: "ok",
        inferredRepeat: false,
      },
      {
        id: "l2",
        index: 1,
        text: "Line Two",
        wordIds: ["w2"],
        startRaw: 3.08, // 80ms gap
        endRaw: 5.0,
        start: 3.08,
        end: 5.0,
        confidence: 1.0,
        status: "ok",
        inferredRepeat: false,
      },
    ];

    const regions = buildRegions({
      lines,
      trackDurationSec: 6.0,
      sampleRate: 44100,
      settings: defaultSettings,
    });

    // Intro (0-1.0), Line 1 (1.0 - 3.08 absorbed), Line 2 (3.08 - 5.0), Outro (5.0 - 6.0) = 4 regions
    expect(regions.length).toBe(4);
    expect(regions[1].end).toBe(3.08); // absorbed gap into line 1
  });
});
