import { WhisperWord, WhisperSegment, LLMAlignmentPlan } from "@/shared/schema";
import { toAlignmentKey } from "../lyrics/normalize";

export function generateMockWhisperWords(durationSec: number = 30): {
  text: string;
  words: WhisperWord[];
  segments: WhisperSegment[];
  raw: Record<string, unknown>;
  cached?: boolean;
} {
  // Default canonical demo song words if none provided
  const sampleWords = [
    { word: "Yeah", start: 1.2, end: 1.6 },
    { word: "Welcome", start: 2.1, end: 2.7 },
    { word: "to", start: 2.75, end: 2.9 },
    { word: "the", start: 2.95, end: 3.1 },
    { word: "sound", start: 3.15, end: 3.7 },
    { word: "of", start: 3.75, end: 3.9 },
    { word: "the", start: 3.95, end: 4.1 },
    { word: "city", start: 4.15, end: 4.8 },
    // instrumental break
    { word: "Neon", start: 6.8, end: 7.3 },
    { word: "lights", start: 7.35, end: 7.9 },
    { word: "are", start: 7.95, end: 8.1 },
    { word: "shining", start: 8.15, end: 8.8 },
    { word: "bright", start: 8.85, end: 9.5 },
    // second line contiguous
    { word: "Walking", start: 9.7, end: 10.2 },
    { word: "through", start: 10.25, end: 10.6 },
    { word: "the", start: 10.65, end: 10.8 },
    { word: "midnight", start: 10.85, end: 11.4 },
    { word: "air", start: 11.45, end: 12.0 },
    // instrumental break
    { word: "Feel", start: 14.5, end: 14.9 },
    { word: "the", start: 14.95, end: 15.1 },
    { word: "rhythm", start: 15.15, end: 15.7 },
    { word: "in", start: 15.75, end: 15.9 },
    { word: "your", start: 15.95, end: 16.2 },
    { word: "heart", start: 16.25, end: 17.0 },
    // outro after 17.0s
  ];

  // Scale timestamps if duration is different
  const scale = durationSec > 0 && durationSec !== 30 ? Math.min(2.0, Math.max(0.5, durationSec / 20)) : 1.0;

  const words: WhisperWord[] = sampleWords.map((sw, idx) => ({
    id: `w_${idx}`,
    word: sw.word,
    start: Number((sw.start * scale).toFixed(3)),
    end: Number((sw.end * scale).toFixed(3)),
    confidence: 0.96,
    segmentId: 0,
  }));

  const text = words.map((w) => w.word).join(" ");
  const segments: WhisperSegment[] = [
    {
      id: 0,
      start: words[0]?.start ?? 0,
      end: words[words.length - 1]?.end ?? durationSec,
      text,
      words,
    },
  ];

  return {
    text,
    words,
    segments,
    raw: { text, words, segments },
    cached: false,
  };
}

export function generateMockLLMPlan(
  officialLines: Array<{ lineIndex: number; text: string }>,
  whisperWords: WhisperWord[]
): LLMAlignmentPlan {
  const lines: LLMAlignmentPlan["lines"] = [];
  let currentWhisperIdx = 0;

  for (const line of officialLines) {
    const lineWords = toAlignmentKey(line.text).split(/\s+/).filter(Boolean);
    const matchedIndices: number[] = [];

    for (let k = 0; k < lineWords.length; k++) {
      if (currentWhisperIdx < whisperWords.length) {
        matchedIndices.push(currentWhisperIdx);
        currentWhisperIdx++;
      }
    }

    lines.push({
      lineIndex: line.lineIndex,
      officialText: line.text,
      matchedWordIndices: matchedIndices,
      inferredRepeat: false,
      confidence: 0.95,
      notes: "aligned",
    });
  }

  // Any remaining whisper words are marked as ad-libs
  const adlibIndices: number[] = [];
  while (currentWhisperIdx < whisperWords.length) {
    adlibIndices.push(currentWhisperIdx);
    currentWhisperIdx++;
  }

  return {
    lines,
    adlibWordIndices: adlibIndices,
    spokenIntroIndices: [],
    confidenceOverall: 0.95,
    summary: `${lines.length} lines reconciled deterministically`,
  };
}
