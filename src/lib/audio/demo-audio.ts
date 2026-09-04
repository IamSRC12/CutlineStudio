import { encodeWav } from "./slice";

/**
 * Generate a 20-second stereo audio buffer with distinct instrumental intro,
 * 5 spoken/melodic vocal bursts, 2 breaks, and an outro.
 */
export function generateDemoSongWav(sampleRate: number = 44100): Uint8Array {
  const durationSec = 20;
  const numSamples = sampleRate * durationSec;
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Time regions:
  // 0.0 - 2.0: Instrumental Intro (Kick + Synth Bass + Chords)
  // 2.0 - 5.0: Line 1 (Vocal tone + beat)
  // 5.0 - 6.5: Instrumental Break 1
  // 6.5 - 9.5: Line 2
  // 9.5 - 12.0: Line 3 (contiguous with line 2)
  // 12.0 - 14.0: Instrumental Break 2
  // 14.0 - 17.0: Line 4 & 5
  // 17.0 - 20.0: Instrumental Outro

  const isVocalActive = (t: number) => {
    return (
      (t >= 2.0 && t <= 5.0) ||
      (t >= 6.5 && t <= 9.5) ||
      (t >= 9.6 && t <= 12.0) ||
      (t >= 14.0 && t <= 15.5) ||
      (t >= 15.6 && t <= 17.0)
    );
  };

  const bpm = 120;
  const beatSec = 60 / bpm; // 0.5s per beat

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // 1. Kick drum every 0.5s
    const beatPhase = (t % beatSec) / beatSec;
    const kickEnv = Math.exp(-beatPhase * 18);
    const kickFreq = 120 * Math.exp(-beatPhase * 25) + 45;
    const kick = Math.sin(2 * Math.PI * kickFreq * beatPhase) * kickEnv * 0.5;

    // 2. Hi-hat on eighth notes (0.25s)
    const hatPhase = (t % (beatSec / 2)) / (beatSec / 2);
    const hatEnv = Math.exp(-hatPhase * 40);
    const hat = (Math.random() * 2 - 1) * hatEnv * 0.15;

    // 3. Bass line
    const bassFreq = t < 10 ? 110 : 98; // A2 / G2
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.25;

    // 4. Synth pads
    const pad =
      (Math.sin(2 * Math.PI * 440 * t) +
        Math.sin(2 * Math.PI * 554.37 * t) +
        Math.sin(2 * Math.PI * 659.25 * t)) *
      0.08;

    // 5. Vocal presence (formant-like melody on vocal active periods)
    let vocal = 0;
    if (isVocalActive(t)) {
      const melodyFreq = 220 + Math.sin(t * 8) * 30;
      const vEnv = Math.min(1, Math.sin((t % 1) * Math.PI) + 0.2);
      vocal =
        (Math.sin(2 * Math.PI * melodyFreq * t) * 0.4 +
          Math.sin(2 * Math.PI * (melodyFreq * 2) * t) * 0.2 +
          Math.sin(2 * Math.PI * (melodyFreq * 3) * t) * 0.1) *
        vEnv *
        0.5;
    }

    const mixedL = kick + hat * 0.8 + bass * 0.9 + pad + vocal * 0.9;
    const mixedR = kick + hat * 1.2 + bass * 0.9 + pad * 1.1 + vocal * 0.9;

    left[i] = Math.max(-0.95, Math.min(0.95, mixedL));
    right[i] = Math.max(-0.95, Math.min(0.95, mixedR));
  }

  return encodeWav([left, right], sampleRate, 16);
}
