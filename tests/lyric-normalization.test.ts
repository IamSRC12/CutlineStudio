import { describe, it, expect } from "vitest";
import { toAlignmentKey } from "@/lib/lyrics/normalize";
import { scoreTokenPair, DEFAULT_NW_PARAMS } from "@/lib/align/needleman-wunsch";

describe("Lyric Normalization and Keying", () => {
  it("matches Don't vs dont vs don’t (curly apostrophe)", () => {
    const straight = "Don't";
    const curly = "don’t"; // unicode \u2019 curly apostrophe
    const withoutApostrophe = "dont";

    const keyStraight = toAlignmentKey(straight);
    const keyCurly = toAlignmentKey(curly);
    const keyWithout = toAlignmentKey(withoutApostrophe);

    // Straight and curly apostrophe must produce the exact same alignment key
    expect(keyStraight).toBe("don't");
    expect(keyCurly).toBe("don't");

    // Comparing keyStraight with keyCurly gives exact match (+2.0)
    const matchEvaluation = scoreTokenPair(keyStraight, keyCurly, DEFAULT_NW_PARAMS);
    expect(matchEvaluation.type).toBe("exact");
    expect(matchEvaluation.score).toBe(2.0);

    // Comparing "don't" with "dont" gives exact or fuzzy match
    const fuzzyEvaluation = scoreTokenPair(keyStraight, keyWithout, DEFAULT_NW_PARAMS);
    expect(["exact", "fuzzy"]).toContain(fuzzyEvaluation.type);
    expect(fuzzyEvaluation.score).toBeGreaterThan(0);
  });

  it("handles NFC normalization and surrounding punctuation", () => {
    const punctuated = `“Welcome...”`;
    const key = toAlignmentKey(punctuated);
    expect(key).toBe("welcome");
  });
});
