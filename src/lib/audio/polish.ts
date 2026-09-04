/**
 * Audio Boundary Polish and Zero-Crossing / RMS Snapping
 */

export interface PolishOptions {
  searchWindowMs?: number; // default ±80 ms
  sampleRate?: number; // default 44100
  direction: "in" | "out";
  minTime?: number; // hard floor (e.g. previous line end or 0)
  maxTime?: number; // hard ceiling (e.g. next line start or duration)
  forbiddenIntervals?: Array<{ start: number; end: number }>; // whisper word interiors
}

/**
 * Find local energy minimum and nearest zero crossing in a search window
 * around candidateTimeSec within audio buffer / PCM data.
 */
export function findPolishedBoundary(
  pcm: Float32Array | null,
  candidateTimeSec: number,
  options: PolishOptions
): number {
  const {
    searchWindowMs = 80,
    sampleRate = 44100,
    direction,
    minTime = 0,
    maxTime = Infinity,
    forbiddenIntervals = [],
  } = options;

  let targetTime = Math.max(minTime, Math.min(maxTime, candidateTimeSec));

  // If no PCM data is available (e.g. metadata-only mode), clamp within min/max and forbidden intervals
  if (!pcm || pcm.length === 0) {
    return targetTime;
  }

  const searchSamples = Math.round((searchWindowMs / 1000) * sampleRate);
  const candidateSample = Math.round(targetTime * sampleRate);
  const minSample = Math.max(0, Math.round(minTime * sampleRate));
  const maxSample = Math.min(pcm.length - 1, Math.round(maxTime * sampleRate));

  const startSearch = Math.max(minSample, candidateSample - searchSamples);
  const endSearch = Math.min(maxSample, candidateSample + searchSamples);

  if (startSearch >= endSearch) {
    return targetTime;
  }

  // Calculate local RMS in small windows (e.g., 5 ms = ~220 samples at 44.1k)
  const windowSize = Math.max(16, Math.round(0.005 * sampleRate));
  let minEnergy = Infinity;
  let bestSample = candidateSample;

  for (let s = startSearch; s <= endSearch - windowSize; s += Math.max(1, Math.floor(windowSize / 2))) {
    const timeAtS = s / sampleRate;

    // Check if inside a forbidden interval (e.g. inside a sung word)
    const isForbidden = forbiddenIntervals.some(
      (interval) => timeAtS > interval.start + 0.01 && timeAtS < interval.end - 0.01
    );
    if (isForbidden) continue;

    let energy = 0;
    for (let k = 0; k < windowSize; k++) {
      const val = pcm[s + k];
      energy += val * val;
    }
    energy = Math.sqrt(energy / windowSize);

    // Add a distance penalty from the candidate sample so we don't wander unnecessarily
    const distSec = Math.abs((s - candidateSample) / sampleRate);
    const cost = energy + distSec * 0.05;

    if (cost < minEnergy) {
      minEnergy = cost;
      bestSample = s;
    }
  }

  // From the best low-energy region, snap to the nearest zero-crossing
  const zcRange = Math.min(windowSize * 2, 400);
  const zcStart = Math.max(startSearch, bestSample - zcRange);
  const zcEnd = Math.min(endSearch - 1, bestSample + zcRange);

  let nearestZcSample = bestSample;
  let minZcDist = Infinity;

  for (let s = zcStart; s <= zcEnd; s++) {
    const current = pcm[s];
    const next = pcm[s + 1];

    // Zero crossing: sign changes or current is exactly 0
    if ((current <= 0 && next >= 0) || (current >= 0 && next <= 0)) {
      const dist = Math.abs(s - bestSample);
      if (dist < minZcDist) {
        minZcDist = dist;
        nearestZcSample = s;
      }
    }
  }

  const polishedSec = nearestZcSample / sampleRate;

  // Final sanity clamp
  return Math.max(minTime, Math.min(maxTime, polishedSec));
}

/**
 * Enforce non-overlapping constraints on a sequence of line time intervals.
 * If line[i].end > line[i+1].start, shrink both towards their raw cores.
 */
export function resolveLineOverlaps(
  lines: Array<{
    startRaw: number;
    endRaw: number;
    start: number;
    end: number;
  }>
): void {
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    if (current.end > next.start) {
      // Overlap detected!
      // Center split point between current.endRaw and next.startRaw if available
      const rawGapCenter = (current.endRaw + next.startRaw) / 2;
      const overlapMidpoint = (current.end + next.start) / 2;

      let splitPoint = overlapMidpoint;
      if (current.endRaw <= next.startRaw) {
        splitPoint = Math.max(current.endRaw, Math.min(next.startRaw, rawGapCenter));
      }

      current.end = Math.min(current.end, splitPoint);
      next.start = Math.max(next.start, splitPoint);

      // Ensure start <= end for each line
      if (current.end < current.start) {
        current.start = Math.min(current.startRaw, current.end);
      }
      if (next.start > next.end) {
        next.end = Math.max(next.endRaw, next.start);
      }
    }
  }
}
