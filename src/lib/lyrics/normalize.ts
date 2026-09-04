/**
 * Lyric Normalization and Keying
 * 
 * Invariants:
 * - NFC unicode normalization
 * - Keep apostrophes inside words (e.g., "don't" -> "don't", "can’t" with curly quote -> "can't")
 * - Alignment key: lowercase, strip non-alphanumeric except intra-word apostrophes, collapse whitespace
 * - Original surface form is preserved
 */

export interface NormalizedToken {
  surface: string;
  key: string;
  isPunctuationOnly: boolean;
}

// Convert curly single quotes / apostrophes to standard straight apostrophe
export function normalizeApostrophes(str: string): string {
  return str.replace(/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'");
}

// Normalize a word or string for alignment comparison
export function toAlignmentKey(text: string): string {
  if (!text) return "";
  
  // 1. NFC normalization
  let s = text.normalize("NFC");
  
  // 2. Normalize curly apostrophes to straight '
  s = normalizeApostrophes(s);
  
  // 3. Lowercase
  s = s.toLowerCase();
  
  // 4. Remove all punctuation except apostrophes that are surrounded by word chars
  // e.g. "don't" -> "don't", "rock 'n' roll" -> "rock 'n' roll", "'hello'" -> "hello"
  s = s
    // replace hyphens with spaces or strip depending on context
    .replace(/[-_—–]/g, " ")
    // replace any non-alphanumeric and non-apostrophe characters with spaces
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    // remove leading and trailing apostrophes from words (e.g. 'word' -> word)
    .replace(/(^|\s)'+/g, "$1")
    .replace(/'+(\s|$)/g, "$1")
    // collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();

  return s;
}

// Generate consonant skeleton for fuzzy phoneme-like matching
export function getConsonantSkeleton(key: string): string {
  return key.replace(/[aeiouy\s']/g, "");
}

// Levenshtein distance for fuzzy matching
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

// Tokenize text line into surface and key tokens
export function tokenizeLine(lineText: string): NormalizedToken[] {
  const tokens: NormalizedToken[] = [];
  if (!lineText) return tokens;

  // Split by whitespace while preserving punctuation in surface form
  const rawWords = lineText.trim().split(/\s+/);
  for (const raw of rawWords) {
    if (!raw) continue;
    const key = toAlignmentKey(raw);
    tokens.push({
      surface: raw,
      key,
      isPunctuationOnly: key.length === 0,
    });
  }
  return tokens;
}
