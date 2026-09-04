# LyricSplit Studio 🎙️✂️

**LyricSplit** is a studio-grade DSP/ASR web application that takes a song audio file and official lyrics, aligns them with sample-accurate timing using Groq Whisper Large v3 Turbo and Llama 3.3 70B reconciliation with Needleman–Wunsch sequence alignment, polishes in/out boundaries to local zero-crossings and RMS minima, and exports every lyric line and every instrumental gap as separate, perfectly cut lossless audio files in a structured ZIP.

---

## 🎯 Canonical Example

A 4-line song with an instrumental intro, two mid-song instrumental breaks, and an outro produces **8 distinct audio files**:

```text
00_instrumental_intro.wav  # 0.0s -> first syllable onset (e.g. 0.0s - 2.0s)
01_line_01_yeah.wav        # Lyric line 1 only (2.0s - 5.0s)
02_instrumental_gap_01.wav # Break between line 1 and 2 (5.0s - 6.5s)
03_line_02_welcome.wav     # Lyric line 2 (6.5s - 9.5s)
04_line_03_neon_lights.wav # Lyric line 3 (contiguous with line 2; no gap emitted)
05_instrumental_gap_02.wav # Break between line 3 and 4 (12.0s - 14.0s)
06_line_04_feel_rhythm.wav # Lyric line 4 (14.0s - 17.0s)
07_instrumental_outro.wav  # 17.0s -> track end
```

*Note: Gaps are only emitted when `duration >= minInstrumentalMs` (default 250 ms). Short micro-gaps below this threshold are automatically absorbed into adjacent lines according to the configurable `absorbPolicy`.*

---

## 🏗️ Architecture & Technology Stack

| Layer | Choice |
| :--- | :--- |
| **Language** | TypeScript 5.9 strict everywhere |
| **Framework** | Next.js 16 (App Router) + Turbopack |
| **UI & Styling** | React 19, TailwindCSS v4 tokens, Lucide React icons |
| **Validation** | Zod (shared schemas for client & server) |
| **State & History** | Immer (100-step undo/redo stack) |
| **Database** | PostgreSQL via Drizzle ORM + Drizzle Kit |
| **Storage & Cache** | Local filesystem storage + IndexedDB crash mirror + ASR cache table |
| **ASR Engine** | Groq Whisper Large v3 Turbo (`timestamp_granularities: ["word", "segment"]`) |
| **LLM Reconciliation** | Groq Llama 3.3 70B Versatile (structured alignment plan) |
| **Alignment DSP** | Custom Needleman–Wunsch token alignment + Radix-2 FFT Cross-Correlation |
| **Audio Engine** | Web Audio API `AudioContext` & `OfflineAudioContext`, sample-accurate scheduler |
| **Export Packaging** | Lossless 16-bit WAV PCM encoder + `fflate` ZIP archiver |
| **Testing** | Vitest (FFT xcorr, sequence alignment, region builder, lossless sample round-trip) |

---

## ⚡ How Alignment Works

1. **Ingest & Probe:** The client hashes the audio and lyrics (SHA-256). Server probes the audio stream via `music-metadata` to determine sample rate (e.g. 44.1 kHz / 48 kHz), bit depth, channels, and duration.
2. **Whisper ASR:** Audio is processed by Groq Whisper Large v3 Turbo, generating word-level and segment-level timestamps.
3. **Llama 3.3 70B Reconciliation:** Official lyrics are treated as the *source of truth for text*, and Whisper timestamps are the *source of truth for time*. The LLM maps official lines to Whisper word indices, marks sung ad-libs, and flags repeats.
4. **Deterministic Needleman–Wunsch:** Global sequence alignment matches official tokens against Whisper words:
   - Match exact: `+2.0`
   - Match fuzzy (Levenshtein ≤ 2, consonant skeleton): `+1.0`
   - Mismatch: `-1.0`
   - Whisper-only ad-lib gap: `-0.25` (cheap to skip extra sung ad-libs)
   - Official-only dropped word gap: `-2.0` (expensive to drop lyric words)
5. **Boundary Polishing:** Around every candidate cut point, a ±80 ms window is evaluated to snap to the nearest RMS local minimum and zero-crossing cluster.
6. **Non-Overlapping Solver:** Enforces `line[i].end <= line[i+1].start`, `0 <= t <= duration`, and resolves edge overlaps without audio distortion.
7. **Region Building:** Emits numbered instrumental intro, lyric lines, inter-line gaps, and outro.

---

## 🎛️ Settings That Affect Cut Quality

| Setting | Default | Description |
| :--- | :--- | :--- |
| `preRollMs` | `40 ms` | Breathing lead-in room added before the first syllable onset of a line. |
| `postRollMs` | `80 ms` | Reverb tail & trailing consonant extension added after the last word of a line. |
| `minInstrumentalMs` | `250 ms` | Minimum silence/break duration required to emit an instrumental gap clip. |
| `absorbPolicy` | `'previous'` | How to handle gaps below `minInstrumentalMs`: absorb into previous line, next line, or split evenly. |
| `boundarySearchMs` | `80 ms` | Search radius for finding local zero-crossings and energy minima. |
| `normalizeClips` | `false` | When true, peak-normalizes every exported clip independently. |

---

## 💻 Local Setup & Development

### Requirements
- **Node.js**: v20+ or v22+
- **PostgreSQL**: Local or remote instance (or Docker)
- **GROQ_API_KEY**: (Optional) For live Whisper Turbo & Llama 3.3 70B execution. When unset or offline, LyricSplit uses high-precision deterministic DSP simulation.

### Environment Variables (`.env`)
```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
GROQ_API_KEY=gsk_... # Optional
STORAGE_DIR=./storage
```

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Push database schema
npx drizzle-kit push

# 3. Run unit & integration tests
npx vitest run

# 4. Start development server
npm run dev
```

---

## ⚠️ Limitations & DSP Edge Cases

- **Heavy Autotune / Vocoder:** Extreme pitch quantizers can mask vocal transients; manual boundary nudge via the Studio timeline is supported (`[` / `]` keys).
- **Choir / Overlapping Backing Vocals:** The alignment engine prioritizes the lead vocal line structure as written in the official lyrics sheet.
- **Hallucinated Solos:** Whisper may hallucinate words during extended guitar solos. LyricSplit treats unmatched solo words as ad-libs and classifies the duration as instrumental.
