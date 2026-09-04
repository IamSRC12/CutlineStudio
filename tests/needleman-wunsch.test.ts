import { describe, it, expect } from "vitest";
import { needlemanWunsch, NWToken, NWWhisperToken, DEFAULT_NW_PARAMS } from "@/lib/align/needleman-wunsch";
import { toAlignmentKey } from "@/lib/lyrics/normalize";

describe("Needleman–Wunsch Sequence Alignment", () => {
  it("aligns a line with an inserted ad-lib word and does not drop official tokens", () => {
    // Official lyric sheet: "welcome to the city"
    const officialWords = ["welcome", "to", "the", "city"];
    const officialTokens: NWToken[] = officialWords.map((word, idx) => ({
      index: idx,
      text: word,
      key: toAlignmentKey(word),
      lineIndex: 0,
    }));

    // Whisper heard: "welcome to the [yeah] city" (with sung ad-lib "yeah")
    const whisperWords = [
      { text: "welcome", start: 1.0, end: 1.5 },
      { text: "to", start: 1.55, end: 1.7 },
      { text: "the", start: 1.75, end: 1.9 },
      { text: "yeah", start: 2.0, end: 2.3 }, // ad-lib inserted
      { text: "city", start: 2.4, end: 3.0 },
    ];

    const whisperTokens: NWWhisperToken[] = whisperWords.map((w, idx) => ({
      index: idx,
      wordId: `w_${idx}`,
      text: w.text,
      key: toAlignmentKey(w.text),
      start: w.start,
      end: w.end,
      confidence: 0.98,
    }));

    const result = needlemanWunsch(officialTokens, whisperTokens, DEFAULT_NW_PARAMS);

    // Verify stats: all 4 official words matched, 1 ad-lib inserted, 0 dropped
    expect(result.stats.exactMatches).toBe(4);
    expect(result.stats.droppedOfficialWords).toBe(0);
    expect(result.stats.adlibsInserted).toBe(1);

    // Verify pairs structure
    const alignedOfficial = result.alignedPairs
      .filter((p) => p.matchType === "exact")
      .map((p) => p.officialToken?.text);

    expect(alignedOfficial).toEqual(["welcome", "to", "the", "city"]);
  });
});
