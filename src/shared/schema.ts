import { z } from "zod";

// Project Settings Schema
export const projectSettingsSchema = z.object({
  language: z.string().optional(),
  preRollMs: z.number().default(40),
  postRollMs: z.number().default(80),
  minInstrumentalMs: z.number().default(250),
  absorbPolicy: z.enum(["previous", "next", "split"]).default("previous"),
  boundarySearchMs: z.number().default(80),
  includeSkipped: z.boolean().default(false),
  exportFormat: z.enum(["wav", "mp3", "both"]).default("wav"),
  normalizeClips: z.boolean().default(false),
  keepAdlibsInLine: z.boolean().default(true),
  spokenAsInstrumental: z.boolean().default(true),
});

export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

// Whisper Word
export const whisperWordSchema = z.object({
  id: z.string(),
  word: z.string(),
  start: z.number(), // seconds
  end: z.number(), // seconds
  confidence: z.number().optional().default(1.0),
  segmentId: z.number().optional(),
});

export type WhisperWord = z.infer<typeof whisperWordSchema>;

// Whisper Segment
export const whisperSegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  words: z.array(whisperWordSchema).optional(),
});

export type WhisperSegment = z.infer<typeof whisperSegmentSchema>;

// Lyric Line Status
export const lineStatusSchema = z.enum(["ok", "unaligned", "low_conf", "edited"]);
export type LineStatus = z.infer<typeof lineStatusSchema>;

// Lyric Line
export const lineSchema = z.object({
  id: z.string(),
  index: z.number(),
  text: z.string(),
  wordIds: z.array(z.string()),
  startRaw: z.number(), // raw start seconds from Whisper
  endRaw: z.number(), // raw end seconds from Whisper
  start: z.number(), // polished start seconds
  end: z.number(), // polished end seconds
  confidence: z.number().default(1.0),
  status: lineStatusSchema.default("ok"),
  inferredRepeat: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export type Line = z.infer<typeof lineSchema>;

// Region Kind
export const regionKindSchema = z.enum([
  "instrumental_intro",
  "line",
  "instrumental_gap",
  "instrumental_outro",
]);
export type RegionKind = z.infer<typeof regionKindSchema>;

// Audio Region (emitted clip)
export const regionSchema = z.object({
  id: z.string(),
  index: z.number(),
  kind: regionKindSchema,
  lineId: z.string().optional(),
  start: z.number(), // polished start in seconds
  end: z.number(), // polished end in seconds
  startSample: z.number().optional(),
  endSample: z.number().optional(),
  skip: z.boolean().default(false),
  label: z.string(),
  rawStart: z.number().optional(),
  rawEnd: z.number().optional(),
});

export type Region = z.infer<typeof regionSchema>;

// LLM Alignment Plan Output Schema
export const llmAlignmentPlanSchema = z.object({
  lines: z.array(
    z.object({
      lineIndex: z.number(),
      officialText: z.string(),
      matchedWordIndices: z.array(z.number()),
      inferredRepeat: z.boolean().default(false),
      confidence: z.number().default(1.0),
      notes: z.string().optional(),
    })
  ),
  adlibWordIndices: z.array(z.number()).default([]),
  spokenIntroIndices: z.array(z.number()).default([]),
  confidenceOverall: z.number().default(1.0),
  summary: z.string().optional(),
});

export type LLMAlignmentPlan = z.infer<typeof llmAlignmentPlanSchema>;

// Document Schema
export const documentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  version: z.number().default(1),
  lyricsOriginal: z.string().default(""),
  lines: z.array(lineSchema).default([]),
  regions: z.array(regionSchema).default([]),
  words: z.array(whisperWordSchema).default([]),
  alignmentTrace: z
    .object({
      score: z.number().optional(),
      matchedTokens: z.number().optional(),
      unmatchedTokens: z.number().optional(),
      llmPlanSummary: z.string().optional(),
    })
    .optional(),
  updatedAt: z.string().optional(),
});

export type Document = z.infer<typeof documentSchema>;

// Project Schema
export const projectStatusSchema = z.enum([
  "draft",
  "ingesting",
  "transcribing",
  "aligning",
  "ready",
  "error",
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: projectSettingsSchema,
  status: projectStatusSchema,
});

export type Project = z.infer<typeof projectSchema>;

// Asset Schema
export const assetKindSchema = z.enum(["mix", "instrumental", "vocals", "lyrics"]);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const assetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  kind: assetKindSchema,
  filename: z.string(),
  mime: z.string(),
  bytes: z.number(),
  sha256: z.string(),
  durationSec: z.number(),
  sampleRate: z.number(),
  channels: z.number(),
  storagePath: z.string(),
});

export type Asset = z.infer<typeof assetSchema>;

// Edit Operations for Immer & Undo/Redo
export const editOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("NUDGE_REGION"),
    regionId: z.string(),
    deltaStartSec: z.number().optional(),
    deltaEndSec: z.number().optional(),
    ripple: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("SET_REGION_TIMES"),
    regionId: z.string(),
    start: z.number(),
    end: z.number(),
  }),
  z.object({
    type: z.literal("TOGGLE_SKIP_REGION"),
    regionId: z.string(),
  }),
  z.object({
    type: z.literal("UPDATE_LINE_TEXT"),
    lineId: z.string(),
    newText: z.string(),
  }),
  z.object({
    type: z.literal("SPLIT_LINE"),
    lineId: z.string(),
    splitWordIndex: z.number(),
  }),
  z.object({
    type: z.literal("MERGE_LINES"),
    firstLineId: z.string(),
    secondLineId: z.string(),
  }),
  z.object({
    type: z.literal("RESET_POLISH"),
    regionId: z.string().optional(), // all if undefined
  }),
  z.object({
    type: z.literal("RECALCULATE_GAPS"),
    minInstrumentalMs: z.number().optional(),
    absorbPolicy: z.enum(["previous", "next", "split"]).optional(),
  }),
  z.object({
    type: z.literal("APPLY_DOCUMENT"),
    document: documentSchema,
  }),
]);

export type EditOperation = z.infer<typeof editOperationSchema>;
