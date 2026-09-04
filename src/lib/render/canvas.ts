import { Document, Region, Line, WhisperWord } from "@/shared/schema";

export interface CanvasViewState {
  width: number;
  height: number;
  startTimeSec: number;
  endTimeSec: number;
  selectedRegionId?: string | null;
  hoveredRegionId?: string | null;
  hoverHandle?: "start" | "end" | null;
  loopStartSec?: number | null;
  loopEndSec?: number | null;
  isLooping?: boolean;
}

export interface CanvasAssets {
  waveformPeaks?: Float32Array | null; // min/max pairs or rms values
  durationSec: number;
}

/**
 * Pure 2D canvas drawing function for DAW timeline
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  currentTimeSec: number,
  doc: Document,
  view: CanvasViewState,
  assets: CanvasAssets
): void {
  const { width, height, startTimeSec, endTimeSec, selectedRegionId, hoveredRegionId } = view;
  if (width <= 0 || height <= 0) return;

  const visibleDuration = Math.max(0.001, endTimeSec - startTimeSec);
  const timeToX = (t: number) => ((t - startTimeSec) / visibleDuration) * width;
  const xToTime = (x: number) => startTimeSec + (x / width) * visibleDuration;

  // Background
  ctx.fillStyle = "#090d16"; // Dark slate studio background
  ctx.fillRect(0, 0, width, height);

  // Draw Grid lines & time rulers (e.g. 1s or 5s intervals)
  const timeStep = visibleDuration > 60 ? 10 : visibleDuration > 20 ? 5 : visibleDuration > 5 ? 1 : 0.2;
  const firstTick = Math.floor(startTimeSec / timeStep) * timeStep;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
  ctx.font = "10px ui-monospace, SFMono-Regular, monospace";

  for (let t = firstTick; t <= endTimeSec; t += timeStep) {
    const x = timeToX(t);
    if (x >= 0 && x <= width) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time tag at top
      const min = Math.floor(t / 60);
      const sec = (t % 60).toFixed(timeStep < 1 ? 1 : 0);
      ctx.fillText(`${min}:${sec.padStart(timeStep < 1 ? 4 : 2, "0")}`, x + 4, 16);
    }
  }

  // Draw Waveform background
  const waveTop = 32;
  const waveHeight = height - 48;
  const waveMidY = waveTop + waveHeight / 2;

  if (assets.waveformPeaks && assets.waveformPeaks.length > 0) {
    const peaks = assets.waveformPeaks;
    const numPairs = peaks.length / 2;
    const trackDuration = assets.durationSec || 1;

    ctx.fillStyle = "rgba(59, 130, 246, 0.15)"; // subtle blue waveform glow
    ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const t = xToTime(x);
      if (t >= 0 && t <= trackDuration) {
        const peakIdx = Math.floor((t / trackDuration) * numPairs) * 2;
        const minVal = peaks[peakIdx] || 0;
        const maxVal = peaks[peakIdx + 1] || 0;

        const y1 = waveMidY - maxVal * (waveHeight / 2) * 0.9;
        const y2 = waveMidY - minVal * (waveHeight / 2) * 0.9;

        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
    }
    ctx.stroke();
  } else {
    // Fallback waveform center line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(0, waveMidY);
    ctx.lineTo(width, waveMidY);
    ctx.stroke();
  }

  // Draw Regions
  const lineMap = new Map<string, Line>();
  for (const l of doc.lines) {
    lineMap.set(l.id, l);
  }

  const wordMap = new Map<string, WhisperWord>();
  for (const w of doc.words) {
    wordMap.set(w.id, w);
  }

  for (const region of doc.regions) {
    const xStart = timeToX(region.start);
    const xEnd = timeToX(region.end);
    const regionWidth = Math.max(2, xEnd - xStart);

    if (xEnd < 0 || xStart > width) continue; // Out of visible bounds

    const isSelected = region.id === selectedRegionId;
    const isHovered = region.id === hoveredRegionId;
    const isLyric = region.kind === "line";
    const isSkipped = region.skip;

    // Region base colors
    let bgFill = "rgba(30, 41, 59, 0.4)"; // default slate
    let borderColor = "rgba(71, 85, 105, 0.6)";

    if (isLyric) {
      bgFill = isSelected
        ? "rgba(16, 185, 129, 0.35)" // emerald selected
        : isHovered
        ? "rgba(16, 185, 129, 0.25)"
        : "rgba(16, 185, 129, 0.18)";
      borderColor = isSelected ? "#10b981" : "rgba(16, 185, 129, 0.6)";
    } else if (region.kind === "instrumental_intro") {
      bgFill = isSelected ? "rgba(168, 85, 247, 0.35)" : "rgba(168, 85, 247, 0.15)";
      borderColor = isSelected ? "#a855f7" : "rgba(168, 85, 247, 0.5)";
    } else if (region.kind === "instrumental_gap") {
      bgFill = isSelected ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.12)";
      borderColor = isSelected ? "#f59e0b" : "rgba(245, 158, 11, 0.45)";
    } else if (region.kind === "instrumental_outro") {
      bgFill = isSelected ? "rgba(236, 72, 153, 0.35)" : "rgba(236, 72, 153, 0.15)";
      borderColor = isSelected ? "#ec4899" : "rgba(236, 72, 153, 0.5)";
    }

    if (isSkipped) {
      bgFill = "rgba(30, 41, 59, 0.2)";
      borderColor = "rgba(100, 116, 139, 0.4)";
    }

    // Fill Region Block
    ctx.fillStyle = bgFill;
    ctx.fillRect(xStart, waveTop, regionWidth, waveHeight);

    // Region Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSelected ? 2 : 1;
    if (isSkipped) {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeRect(xStart, waveTop, regionWidth, waveHeight);
    ctx.setLineDash([]); // reset

    // Draw In/Out Drag Handles if selected
    if (isSelected) {
      ctx.fillStyle = borderColor;
      // In handle (left)
      ctx.fillRect(xStart - 3, waveTop, 6, 18);
      // Out handle (right)
      ctx.fillRect(xEnd - 3, waveTop, 6, 18);
    }

    // Draw Word Ticks inside lyric line
    if (isLyric && region.lineId) {
      const line = lineMap.get(region.lineId);
      if (line && line.wordIds) {
        ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;

        for (const wId of line.wordIds) {
          const w = wordMap.get(wId);
          if (w) {
            const wX = timeToX(w.start);
            if (wX >= xStart && wX <= xEnd) {
              ctx.beginPath();
              ctx.moveTo(wX, waveTop + waveHeight - 14);
              ctx.lineTo(wX, waveTop + waveHeight);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Region Label Header
    ctx.fillStyle = isSelected ? "#ffffff" : "rgba(241, 245, 249, 0.8)";
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    const matchedLine = region.lineId ? lineMap.get(region.lineId) : undefined;
    const displayText = isLyric && matchedLine ? matchedLine.text : region.label;
    const textWidth = ctx.measureText(displayText).width;

    // Only render text if box is wide enough
    if (regionWidth > 30) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(xStart + 4, waveTop + 4, Math.max(0, regionWidth - 8), 18);
      ctx.clip();
      ctx.fillText(displayText, xStart + 6, waveTop + 16);
      ctx.restore();
    }
  }

  // Draw Loop Region if enabled
  if (view.isLooping && view.loopStartSec !== undefined && view.loopEndSec !== undefined && view.loopStartSec !== null && view.loopEndSec !== null) {
    const loopX1 = timeToX(view.loopStartSec);
    const loopX2 = timeToX(view.loopEndSec);
    ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
    ctx.fillRect(loopX1, 0, loopX2 - loopX1, height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(loopX1, 0, loopX2 - loopX1, height);
  }

  // Draw Playhead
  const playheadX = timeToX(currentTimeSec);
  if (playheadX >= 0 && playheadX <= width) {
    ctx.strokeStyle = "#f43f5e"; // bright rose playhead
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead head marker (triangle)
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 10);
    ctx.closePath();
    ctx.fill();
  }
}
