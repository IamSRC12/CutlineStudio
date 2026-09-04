export interface LrcLine {
  timeSec: number;
  text: string;
}

export interface ParsedLrc {
  isLrc: boolean;
  metadata: Record<string, string>;
  lines: LrcLine[];
}

export function parseLrc(content: string): ParsedLrc {
  const lines = content.split(/\r?\n/);
  const resultLines: LrcLine[] = [];
  const metadata: Record<string, string> = {};
  let isLrc = false;

  // Regex for [mm:ss.xx] or [mm:ss.xxx] or [mm:ss:xx]
  const lrcRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
  const metaRegex = /^\[([a-zA-Z]+):(.*)\]$/;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check meta tags like [ti:Title], [ar:Artist]
    const metaMatch = trimmed.match(metaRegex);
    if (metaMatch && !trimmed.match(lrcRegex)) {
      metadata[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }

    // Find all timestamp tags on this line
    const matches = Array.from(trimmed.matchAll(lrcRegex));
    if (matches.length > 0) {
      isLrc = true;
      const text = trimmed.replace(lrcRegex, "").trim();
      
      for (const m of matches) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const millisStr = m[3] || "0";
        const millis = millisStr.length === 2 ? parseInt(millisStr, 10) * 10 : parseInt(millisStr.padEnd(3, "0").slice(0, 3), 10);
        const timeSec = minutes * 60 + seconds + millis / 1000;

        resultLines.push({
          timeSec,
          text,
        });
      }
    }
  }

  resultLines.sort((a, b) => a.timeSec - b.timeSec);

  return {
    isLrc,
    metadata,
    lines: resultLines,
  };
}
