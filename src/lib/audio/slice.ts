/**
 * Sample-accurate PCM slicing and WAV audio encoding
 */

export function slicePcm(
  channelData: Float32Array,
  startSample: number,
  endSample: number
): Float32Array {
  const start = Math.max(0, Math.min(channelData.length, startSample));
  const end = Math.max(start, Math.min(channelData.length, endSample));
  return channelData.slice(start, end);
}

/**
 * Peak-normalize an array of audio channels in-place
 */
export function normalizeAudio(channels: Float32Array[], targetPeak: number = 0.98): void {
  let maxVal = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > maxVal) maxVal = abs;
    }
  }

  if (maxVal > 0.00001 && maxVal !== targetPeak) {
    const gain = targetPeak / maxVal;
    for (const ch of channels) {
      for (let i = 0; i < ch.length; i++) {
        ch[i] *= gain;
      }
    }
  }
}

/**
 * Encode Float32Array PCM audio into a standard RIFF/WAVE byte array
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number = 44100,
  bitDepth: 16 | 24 | 32 = 16
): Uint8Array {
  const numChannels = channels.length;
  if (numChannels === 0) return new Uint8Array(0);

  const numSamples = channels[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Helper to write string to DataView
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // 1 = PCM, 3 = IEEE float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Write audio samples
  let offset = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        // Clip to [-1.0, 1.0]
        sample = Math.max(-1.0, Math.min(1.0, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, Math.round(intSample), true);
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        sample = Math.max(-1.0, Math.min(1.0, sample));
        const intSample = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7fffff);
        view.setUint8(offset, intSample & 0xff);
        view.setUint8(offset + 1, (intSample >> 8) & 0xff);
        view.setUint8(offset + 2, (intSample >> 16) & 0xff);
        offset += 3;
      }
    }
  } else if (bitDepth === 32) {
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        view.setFloat32(offset, channels[ch][i], true);
        offset += 4;
      }
    }
  }

  return new Uint8Array(buffer);
}
