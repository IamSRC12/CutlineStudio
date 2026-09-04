import { produce } from "immer";
import { Document, EditOperation, ProjectSettings } from "@/shared/schema";
import { buildRegions } from "../align/region-builder";
import { resolveLineOverlaps } from "../audio/polish";

export function applyDocumentOperation(
  doc: Document,
  op: EditOperation,
  settings: ProjectSettings,
  trackDurationSec: number = 0,
  sampleRate: number = 44100
): Document {
  return produce(doc, (draft) => {
    draft.version = (draft.version || 1) + 1;
    draft.updatedAt = new Date().toISOString();

    switch (op.type) {
      case "NUDGE_REGION": {
        const region = draft.regions.find((r) => r.id === op.regionId);
        if (!region) return;

        const deltaStart = op.deltaStartSec || 0;
        const deltaEnd = op.deltaEndSec || 0;

        region.start = Math.max(0, region.start + deltaStart);
        region.end = Math.max(region.start + 0.05, region.end + deltaEnd);

        // Also update matching line if this region belongs to a line
        if (region.lineId) {
          const line = draft.lines.find((l) => l.id === region.lineId);
          if (line) {
            line.start = region.start;
            line.end = region.end;
            line.status = "edited";
          }
        }

        // Ripple mode: shift subsequent regions if ripple is enabled
        if (op.ripple && deltaEnd !== 0) {
          const rIndex = region.index;
          for (let i = rIndex + 1; i < draft.regions.length; i++) {
            draft.regions[i].start += deltaEnd;
            draft.regions[i].end += deltaEnd;
            if (draft.regions[i].lineId) {
              const l = draft.lines.find((line) => line.id === draft.regions[i].lineId);
              if (l) {
                l.start = draft.regions[i].start;
                l.end = draft.regions[i].end;
              }
            }
          }
        }
        break;
      }

      case "SET_REGION_TIMES": {
        const region = draft.regions.find((r) => r.id === op.regionId);
        if (!region) return;

        region.start = Math.max(0, op.start);
        region.end = Math.max(region.start + 0.05, op.end);

        if (region.lineId) {
          const line = draft.lines.find((l) => l.id === region.lineId);
          if (line) {
            line.start = region.start;
            line.end = region.end;
            line.status = "edited";
          }
        }
        break;
      }

      case "TOGGLE_SKIP_REGION": {
        const region = draft.regions.find((r) => r.id === op.regionId);
        if (region) {
          region.skip = !region.skip;
        }
        break;
      }

      case "UPDATE_LINE_TEXT": {
        const line = draft.lines.find((l) => l.id === op.lineId);
        if (line) {
          line.text = op.newText;
          line.status = "edited";
        }
        break;
      }

      case "SPLIT_LINE": {
        const lineIdx = draft.lines.findIndex((l) => l.id === op.lineId);
        if (lineIdx === -1) return;

        const line = draft.lines[lineIdx];
        const words = draft.words.filter((w) => line.wordIds.includes(w.id));
        if (words.length <= 1 || op.splitWordIndex <= 0 || op.splitWordIndex >= words.length) return;

        const firstWordSub = words.slice(0, op.splitWordIndex);
        const secondWordSub = words.slice(op.splitWordIndex);

        const firstWords = firstWordSub.map((w) => w.word).join(" ");
        const secondWords = secondWordSub.map((w) => w.word).join(" ");

        const midTime = (firstWordSub[firstWordSub.length - 1].end + secondWordSub[0].start) / 2;

        const newLine1 = {
          ...line,
          text: firstWords,
          wordIds: firstWordSub.map((w) => w.id),
          endRaw: firstWordSub[firstWordSub.length - 1].end,
          end: midTime,
          status: "edited" as const,
        };

        const newLine2 = {
          id: `line_${Date.now()}`,
          index: lineIdx + 1,
          text: secondWords,
          wordIds: secondWordSub.map((w) => w.id),
          startRaw: secondWordSub[0].start,
          endRaw: secondWordSub[secondWordSub.length - 1].end,
          start: midTime,
          end: line.end,
          confidence: line.confidence,
          status: "edited" as const,
          inferredRepeat: false,
        };

        draft.lines.splice(lineIdx, 1, newLine1, newLine2);
        // Re-index lines
        draft.lines.forEach((l, idx) => {
          l.index = idx;
        });

        // Rebuild regions
        const newRegions = buildRegions({
          lines: draft.lines,
          trackDurationSec: trackDurationSec || line.end + 5,
          sampleRate,
          settings,
        });
        draft.regions = newRegions;
        break;
      }

      case "MERGE_LINES": {
        const idx1 = draft.lines.findIndex((l) => l.id === op.firstLineId);
        const idx2 = draft.lines.findIndex((l) => l.id === op.secondLineId);
        if (idx1 === -1 || idx2 === -1 || Math.abs(idx1 - idx2) !== 1) return;

        const first = idx1 < idx2 ? draft.lines[idx1] : draft.lines[idx2];
        const second = idx1 < idx2 ? draft.lines[idx2] : draft.lines[idx1];
        const removeIdx = Math.max(idx1, idx2);

        first.text = `${first.text} ${second.text}`;
        first.wordIds = [...first.wordIds, ...second.wordIds];
        first.endRaw = second.endRaw;
        first.end = second.end;
        first.status = "edited";

        draft.lines.splice(removeIdx, 1);
        draft.lines.forEach((l, idx) => {
          l.index = idx;
        });

        const newRegions = buildRegions({
          lines: draft.lines,
          trackDurationSec: trackDurationSec || first.end + 5,
          sampleRate,
          settings,
        });
        draft.regions = newRegions;
        break;
      }

      case "RESET_POLISH": {
        for (const line of draft.lines) {
          if (line.status !== "unaligned") {
            line.start = line.startRaw;
            line.end = line.endRaw;
          }
        }
        resolveLineOverlaps(draft.lines);

        const newRegions = buildRegions({
          lines: draft.lines,
          trackDurationSec: trackDurationSec || 30,
          sampleRate,
          settings,
        });
        draft.regions = newRegions;
        break;
      }

      case "RECALCULATE_GAPS": {
        const mergedSettings = {
          ...settings,
          minInstrumentalMs: op.minInstrumentalMs ?? settings.minInstrumentalMs,
          absorbPolicy: op.absorbPolicy ?? settings.absorbPolicy,
        };
        const newRegions = buildRegions({
          lines: draft.lines,
          trackDurationSec: trackDurationSec || 30,
          sampleRate,
          settings: mergedSettings,
        });
        draft.regions = newRegions;
        break;
      }

      case "APPLY_DOCUMENT": {
        return op.document;
      }
    }
  });
}
