import { Document, Project, Region, Line } from "@/shared/schema";

export interface ClipManifestItem {
  index: number;
  filename: string;
  kind: Region["kind"];
  label: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  startSample: number;
  endSample: number;
  sampleCount: number;
  lyricText?: string;
  lineId?: string;
  skip: boolean;
}

export interface ProjectManifest {
  version: string;
  generator: string;
  projectId: string;
  projectTitle: string;
  sampleRate: number;
  totalDurationSec: number;
  totalClips: number;
  clips: ClipManifestItem[];
  settings: Project["settings"];
}

export function generateManifest(params: {
  project: Project;
  document: Document;
  sampleRate: number;
  durationSec: number;
  format?: string;
}): ProjectManifest {
  const { project, document, sampleRate, durationSec, format = "wav" } = params;

  const lineMap = new Map<string, Line>();
  for (const line of document.lines) {
    lineMap.set(line.id, line);
  }

  const clips: ClipManifestItem[] = document.regions.map((region) => {
    const matchedLine = region.lineId ? lineMap.get(region.lineId) : undefined;
    const startSample = region.startSample ?? Math.round(region.start * sampleRate);
    const endSample = region.endSample ?? Math.round(region.end * sampleRate);
    const filename = `${region.label}.${format}`;

    return {
      index: region.index,
      filename,
      kind: region.kind,
      label: region.label,
      startSec: Number(region.start.toFixed(4)),
      endSec: Number(region.end.toFixed(4)),
      durationSec: Number((region.end - region.start).toFixed(4)),
      startSample,
      endSample,
      sampleCount: endSample - startSample,
      lyricText: matchedLine?.text,
      lineId: region.lineId,
      skip: region.skip,
    };
  });

  return {
    version: "1.0.0",
    generator: "LyricSplit Studio",
    projectId: project.id,
    projectTitle: project.title,
    sampleRate,
    totalDurationSec: durationSec,
    totalClips: clips.length,
    clips,
    settings: project.settings,
  };
}

/**
 * Generate standard .lrc file text from lines
 */
export function generateLrc(document: Document, title?: string): string {
  const lrcLines: string[] = [];
  if (title) {
    lrcLines.push(`[ti:${title}]`);
    lrcLines.push(`[re:LyricSplit Studio]`);
  }

  for (const line of document.lines) {
    if (line.status === "unaligned" || line.end <= line.start) continue;

    const totalSec = Math.max(0, line.start);
    const minutes = Math.floor(totalSec / 60);
    const seconds = Math.floor(totalSec % 60);
    const hundredths = Math.floor((totalSec % 1) * 100);

    const timeTag = `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
      hundredths
    ).padStart(2, "0")}]`;

    lrcLines.push(`${timeTag} ${line.text}`);
  }

  return lrcLines.join("\n");
}
