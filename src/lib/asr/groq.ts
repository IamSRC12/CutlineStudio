import Groq from "groq-sdk";
import fs from "fs";
import { llmAlignmentPlanSchema, LLMAlignmentPlan, WhisperWord, WhisperSegment } from "@/shared/schema";
import { SYSTEM_PROMPT_RECONCILE, buildReconcileUserPrompt, buildJsonRepairPrompt } from "./prompts";
import { generateMockWhisperWords, generateMockLLMPlan } from "./mock-asr";

export interface TranscribeAudioParams {
  filePath: string;
  language?: string;
  durationSec?: number;
}

export interface TranscribeResult {
  text: string;
  words: WhisperWord[];
  segments: WhisperSegment[];
  raw: Record<string, unknown>;
  cached?: boolean;
}

/**
 * Transcribe audio using Groq Whisper Large v3 Turbo
 */
export async function transcribeAudioWithGroq(
  params: TranscribeAudioParams
): Promise<TranscribeResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "mock_key") {
    // Graceful offline fallback
    return generateMockWhisperWords(params.durationSec || 30);
  }

  const groq = new Groq({ apiKey });

  try {
    const fileStream = fs.createReadStream(params.filePath);

    // Call Groq Whisper Large v3 Turbo
    // Note: groq-sdk supports timestamp_granularities with verbose_json
    const transcription = await groq.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      temperature: 0,
      language: params.language,
    });

    const raw = transcription as unknown as Record<string, unknown>;
    const rawWords = (raw.words as Array<{ word: string; start: number; end: number; probability?: number }>) || [];
    const rawSegments = (raw.segments as Array<{ id: number; start: number; end: number; text: string }>) || [];

    const words: WhisperWord[] = rawWords.map((w, idx) => ({
      id: `w_${idx}`,
      word: w.word.trim(),
      start: Number(w.start),
      end: Number(w.end),
      confidence: w.probability ?? 1.0,
      segmentId: 0,
    }));

    const segments: WhisperSegment[] = rawSegments.map((s) => ({
      id: s.id,
      start: Number(s.start),
      end: Number(s.end),
      text: s.text,
    }));

    return {
      text: (raw.text as string) || "",
      words,
      segments,
      raw,
      cached: false,
    };
  } catch (err) {
    console.error("Groq Whisper error, falling back to simulated ASR:", err);
    return generateMockWhisperWords(params.durationSec || 30);
  }
}

/**
 * Reconcile official lyrics with Whisper words using Groq Llama 3.3 70B Versatile
 */
export async function reconcileLyricsWithLlama(params: {
  officialLines: Array<{ lineIndex: number; text: string }>;
  whisperWords: WhisperWord[];
  language?: string;
}): Promise<LLMAlignmentPlan> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "mock_key") {
    // Offline deterministic LLM plan fallback
    return generateMockLLMPlan(params.officialLines, params.whisperWords);
  }

  const groq = new Groq({ apiKey });
  const userPrompt = buildReconcileUserPrompt({
    officialLines: params.officialLines,
    whisperWords: params.whisperWords.map((w, idx) => ({
      index: idx,
      word: w.word,
      start: w.start,
      end: w.end,
    })),
    language: params.language,
  });

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_RECONCILE },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message?.content || "{}";
    let parsedJson = JSON.parse(rawContent);

    // Validate with Zod
    const validated = llmAlignmentPlanSchema.safeParse(parsedJson);
    if (validated.success) {
      return validated.data;
    }

    // Try repair prompt once
    console.warn("LLM alignment output failed validation, attempting 1 repair:", validated.error.message);
    const repairPrompt = buildJsonRepairPrompt(rawContent, validated.error.message);

    const repairResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_RECONCILE },
        { role: "user", content: repairPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0,
    });

    const repairedContent = repairResponse.choices[0]?.message?.content || "{}";
    parsedJson = JSON.parse(repairedContent);

    const reValidated = llmAlignmentPlanSchema.parse(parsedJson);
    return reValidated;
  } catch (err) {
    console.error("Groq Llama 3.3 reconciliation error, using deterministic fallback:", err);
    return generateMockLLMPlan(params.officialLines, params.whisperWords);
  }
}
