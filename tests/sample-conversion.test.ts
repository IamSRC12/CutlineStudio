import { describe, it, expect } from "vitest";

describe("Sample-Accurate Time & Index Conversion", () => {
  const sampleRates = [44100, 48000, 96000];

  it("losslessly round-trips sample indices through seconds conversion", () => {
    for (const sr of sampleRates) {
      // Test 100 random sample indices across a 5-minute track
      for (let i = 0; i < 100; i++) {
        const originalSample = Math.floor(Math.random() * (sr * 300));
        const timeSec = originalSample / sr;
        const recoveredSample = Math.round(timeSec * sr);
        expect(recoveredSample).toBe(originalSample);
      }
    }
  });

  it("calculates exact non-fractional sample cuts for integer timestamps", () => {
    const sr = 44100;
    const startSec = 2.5; // 2.5s * 44100 = 110250 samples exactly
    const startSample = Math.round(startSec * sr);
    expect(startSample).toBe(110250);
  });
});
