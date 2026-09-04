import { levenshtein, getConsonantSkeleton, toAlignmentKey } from "../lyrics/normalize";
import { WhisperWord } from "@/shared/schema";

export interface NWToken {
  index: number;
  text: string;
  key: string;
  lineIndex: number;
  isAdlib?: boolean;
}

export interface NWWhisperToken {
  index: number;
  wordId: string;
  text: string;
  key: string;
  start: number;
  end: number;
  confidence: number;
}

export interface NWScoreParams {
  matchExact: number;
  matchFuzzy: number;
  mismatch: number;
  gapOpen: number;
  gapExtend: number;
  whisperAdlibGap: number; // gap penalty for skipping a whisper word (sung ad-lib)
  officialWordGap: number; // gap penalty for missing an official word
}

export const DEFAULT_NW_PARAMS: NWScoreParams = {
  matchExact: 2.0,
  matchFuzzy: 1.0,
  mismatch: -1.0,
  gapOpen: -1.5,
  gapExtend: -0.5,
  whisperAdlibGap: -0.25,
  officialWordGap: -2.0,
};

export interface AlignedPair {
  officialIndex: number | null; // null if whisper inserted (adlib)
  whisperIndex: number | null; // null if official word dropped
  officialToken?: NWToken;
  whisperToken?: NWWhisperToken;
  matchType: "exact" | "fuzzy" | "official_gap" | "whisper_adlib" | "mismatch";
  score: number;
}

export interface NWResult {
  score: number;
  alignedPairs: AlignedPair[];
  stats: {
    exactMatches: number;
    fuzzyMatches: number;
    droppedOfficialWords: number;
    adlibsInserted: number;
  };
}

/**
 * Compare two alignment keys and return match score and type
 */
export function scoreTokenPair(
  officialKey: string,
  whisperKey: string,
  params: NWScoreParams
): { score: number; type: "exact" | "fuzzy" | "mismatch" } {
  if (!officialKey || !whisperKey) {
    return { score: params.mismatch, type: "mismatch" };
  }

  // 1. Exact match
  if (officialKey === whisperKey) {
    return { score: params.matchExact, type: "exact" };
  }

  // 2. Exact match when removing all remaining non-letters
  const cleanOff = officialKey.replace(/['\s]/g, "");
  const cleanWhisp = whisperKey.replace(/['\s]/g, "");
  if (cleanOff === cleanWhisp && cleanOff.length > 0) {
    return { score: params.matchExact, type: "exact" };
  }

  // 3. Fuzzy match: Levenshtein distance <= 2 for words >= 4 chars, or 1 for words >= 3 chars
  const dist = levenshtein(cleanOff, cleanWhisp);
  const maxLen = Math.max(cleanOff.length, cleanWhisp.length);

  if ((maxLen >= 4 && dist <= 2) || (maxLen >= 3 && dist <= 1)) {
    return { score: params.matchFuzzy, type: "fuzzy" };
  }

  // 4. Consonant skeleton match (e.g. vocal slur / missing vowels)
  const skelOff = getConsonantSkeleton(cleanOff);
  const skelWhisp = getConsonantSkeleton(cleanWhisp);
  if (skelOff.length >= 2 && skelOff === skelWhisp) {
    return { score: params.matchFuzzy, type: "fuzzy" };
  }

  // 5. Prefix match (e.g. singer cut off or Whisper truncated word)
  if (
    maxLen >= 5 &&
    (cleanOff.startsWith(cleanWhisp) || cleanWhisp.startsWith(cleanOff)) &&
    Math.min(cleanOff.length, cleanWhisp.length) >= 3
  ) {
    return { score: params.matchFuzzy, type: "fuzzy" };
  }

  return { score: params.mismatch, type: "mismatch" };
}

/**
 * Needleman-Wunsch Global Alignment algorithm
 */
export function needlemanWunsch(
  officialTokens: NWToken[],
  whisperTokens: NWWhisperToken[],
  params: NWScoreParams = DEFAULT_NW_PARAMS
): NWResult {
  const n = officialTokens.length;
  const m = whisperTokens.length;

  if (n === 0 && m === 0) {
    return {
      score: 0,
      alignedPairs: [],
      stats: { exactMatches: 0, fuzzyMatches: 0, droppedOfficialWords: 0, adlibsInserted: 0 },
    };
  }

  // DP table: (n + 1) x (m + 1)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Float64Array(m + 1) as unknown as number[]);

  // Direction traceback: 0 = diag, 1 = up (official gap / dropped), 2 = left (whisper gap / ad-lib)
  const trace: Uint8Array[] = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));

  dp[0][0] = 0;

  // Initialize first row: skipping whisper words (whisper ad-lib)
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] + params.whisperAdlibGap;
    trace[0][j] = 2;
  }

  // Initialize first column: dropping official lyric words
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + params.officialWordGap;
    trace[i][0] = 1;
  }

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    const offToken = officialTokens[i - 1];

    for (let j = 1; j <= m; j++) {
      const whispToken = whisperTokens[j - 1];

      // 1. Diagonal match/mismatch
      const matchEval = scoreTokenPair(offToken.key, whispToken.key, params);
      const scoreDiag = dp[i - 1][j - 1] + matchEval.score;

      // 2. Up: Official word has no match in Whisper (dropped official word)
      const scoreUp = dp[i - 1][j] + params.officialWordGap;

      // 3. Left: Whisper word is an extra ad-lib not in lyrics
      const scoreLeft = dp[i][j - 1] + params.whisperAdlibGap;

      // Pick best score
      let best = scoreDiag;
      let dir = 0; // diagonal

      if (scoreUp > best) {
        best = scoreUp;
        dir = 1; // up
      }
      if (scoreLeft > best) {
        best = scoreLeft;
        dir = 2; // left
      }

      dp[i][j] = best;
      trace[i][j] = dir;
    }
  }

  // Traceback
  const alignedPairs: AlignedPair[] = [];
  let i = n;
  let j = m;

  let exactMatches = 0;
  let fuzzyMatches = 0;
  let droppedOfficialWords = 0;
  let adlibsInserted = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trace[i][j] === 0) {
      const off = officialTokens[i - 1];
      const whisp = whisperTokens[j - 1];
      const evalMatch = scoreTokenPair(off.key, whisp.key, params);

      if (evalMatch.type === "exact") exactMatches++;
      else if (evalMatch.type === "fuzzy") fuzzyMatches++;

      alignedPairs.unshift({
        officialIndex: i - 1,
        whisperIndex: j - 1,
        officialToken: off,
        whisperToken: whisp,
        matchType: evalMatch.type,
        score: evalMatch.score,
      });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || trace[i][j] === 1)) {
      // Official word dropped
      droppedOfficialWords++;
      alignedPairs.unshift({
        officialIndex: i - 1,
        whisperIndex: null,
        officialToken: officialTokens[i - 1],
        matchType: "official_gap",
        score: params.officialWordGap,
      });
      i--;
    } else {
      // Whisper adlib inserted
      adlibsInserted++;
      alignedPairs.unshift({
        officialIndex: null,
        whisperIndex: j - 1,
        whisperToken: whisperTokens[j - 1],
        matchType: "whisper_adlib",
        score: params.whisperAdlibGap,
      });
      j--;
    }
  }

  return {
    score: dp[n][m],
    alignedPairs,
    stats: {
      exactMatches,
      fuzzyMatches,
      droppedOfficialWords,
      adlibsInserted,
    },
  };
}

/**
 * Map raw Whisper words to NWWhisperTokens
 */
export function whisperWordsToNWTokens(words: WhisperWord[]): NWWhisperToken[] {
  return words.map((w, index) => ({
    index,
    wordId: w.id,
    text: w.word,
    key: toAlignmentKey(w.word),
    start: w.start,
    end: w.end,
    confidence: w.confidence ?? 1.0,
  }));
}
