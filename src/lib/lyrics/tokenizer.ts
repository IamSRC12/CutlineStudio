import { tokenizeLine, NormalizedToken } from "./normalize";

export interface ParsedLyricLine {
  originalIndex: number;
  rawText: string;
  cleanText: string;
  tokens: NormalizedToken[];
  isHeaderOrMeta: boolean;
  repeatCount?: number;
  hasTimestamp?: boolean;
  timestampSec?: number;
}

export function parseLyrics(rawLyrics: string): ParsedLyricLine[] {
  if (!rawLyrics) return [];

  const rawLines = rawLyrics.split(/\r?\n/);
  const parsedLines: ParsedLyricLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].trim();
    if (!raw) continue;

    // Check if it is a section header like [Chorus], [Verse 1], [Intro], [Bridge]
    const isSectionHeader = /^\[[\w\s\d_.-]+\]$/i.test(raw);
    
    // Check for repeat pattern like (x2), (repeat 2x), (2x)
    const repeatMatch = raw.match(/\((?:repeat\s*)?(\d+)x?\)/i) || raw.match(/\[(\d+)x\]/i);
    const repeatCount = repeatMatch ? parseInt(repeatMatch[1], 10) : undefined;
    
    // Clean text without brackets if needed, or keep clean
    const clean = raw.replace(/\((?:repeat\s*)?\d+x?\)/gi, "").trim();
    const tokens = tokenizeLine(clean);

    parsedLines.push({
      originalIndex: i,
      rawText: raw,
      cleanText: clean,
      tokens: tokens.filter((t) => !t.isPunctuationOnly),
      isHeaderOrMeta: isSectionHeader,
      repeatCount,
    });
  }

  return parsedLines;
}
