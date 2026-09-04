"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Music,
  Upload,
  FileAudio,
  FileText,
  Sparkles,
  Sliders,
  Play,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Layers,
  Zap,
} from "lucide-react";
import { parseLrc } from "@/lib/lyrics/lrc-parser";

interface RecentProject {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  settingsJson: {
    language?: string;
    preRollMs: number;
    postRollMs: number;
    minInstrumentalMs: number;
  };
}

export default function LandingPage() {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState("Midnight Beat");
  const [lyrics, setLyrics] = useState(
    `Yeah\nWelcome to the sound of the city\nNeon lights are shining bright\nWalking through the midnight air\nFeel the rhythm in your heart`
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("en");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Settings
  const [preRollMs, setPreRollMs] = useState(40);
  const [postRollMs, setPostRollMs] = useState(80);
  const [minInstrumentalMs, setMinInstrumentalMs] = useState(250);
  const [absorbPolicy, setAbsorbPolicy] = useState<"previous" | "next" | "split">("previous");

  // Status
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<string>("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Fetch recent projects
  const fetchRecentProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) {
        setRecentProjects(data.projects || []);
      }
    } catch (err) {
      console.warn("Failed to fetch projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentProjects();
  }, [fetchRecentProjects]);

  // Audio File Handler
  const handleAudioDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAudioFile(file);
      if (!title || title === "Midnight Beat") {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleAudioFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioFile(file);
      if (!title || title === "Midnight Beat") {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Lyrics File Upload (.txt or .lrc)
  const handleLyricsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const text = await file.text();

      if (file.name.endsWith(".lrc")) {
        const parsed = parseLrc(text);
        if (parsed.isLrc && parsed.lines.length > 0) {
          setLyrics(parsed.lines.map((l) => l.text).join("\n"));
        } else {
          setLyrics(text);
        }
      } else {
        setLyrics(text);
      }
    }
  };

  // Submit and Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyrics.trim()) {
      alert("Please enter or paste lyrics before creating a project.");
      return;
    }

    try {
      setIsCreating(true);
      setCreationStep("Creating project workspace...");

      // 1. Create project
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Song",
          lyrics: lyrics.trim(),
          useDemoSong: !audioFile, // If no custom audio, use synthetic demo song
          settings: {
            language: language || undefined,
            preRollMs,
            postRollMs,
            minInstrumentalMs,
            absorbPolicy,
          },
        }),
      });

      const projData = await projRes.json();
      if (!projData.success) throw new Error(projData.error || "Project creation failed");

      const projectId = projData.projectId;

      // 2. Upload audio if user selected a custom file
      if (audioFile) {
        setCreationStep("Uploading and probing audio mix (music-metadata)...");
        const formData = new FormData();
        formData.append("file", audioFile);
        formData.append("kind", "mix");

        const uploadRes = await fetch(`/api/projects/${projectId}/assets`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({ error: "Audio upload failed" }));
          throw new Error(errData.error || `Audio upload failed with status ${uploadRes.status}`);
        }
      }

      // 3. Upload stem if provided
      if (instrumentalFile) {
        setCreationStep("Uploading backing stem...");
        const stemFormData = new FormData();
        stemFormData.append("file", instrumentalFile);
        stemFormData.append("kind", "instrumental");

        const stemRes = await fetch(`/api/projects/${projectId}/assets`, {
          method: "POST",
          body: stemFormData,
        });
        if (!stemRes.ok) {
          const errData = await stemRes.json().catch(() => ({ error: "Backing stem upload failed" }));
          throw new Error(errData.error || `Backing stem upload failed with status ${stemRes.status}`);
        }
      }

      // 4. Run Whisper ASR
      setCreationStep("Transcribing audio timestamps with Whisper Large v3 Turbo...");
      const asrRes = await fetch(`/api/projects/${projectId}/transcribe`, { method: "POST" });
      if (!asrRes.ok) {
        const errData = await asrRes.json().catch(() => ({ error: "Transcription failed" }));
        console.warn("ASR warning:", errData);
      }

      // 5. Run Alignment & Region Polish
      setCreationStep("Reconciling lyrics with Llama 3.3 70B & Needleman–Wunsch alignment...");
      const alignRes = await fetch(`/api/projects/${projectId}/align`, { method: "POST" });
      if (!alignRes.ok) {
        const errData = await alignRes.json().catch(() => ({ error: "Alignment failed" }));
        console.warn("Alignment warning:", errData);
      }

      // Navigate to Studio
      setCreationStep("Opening Studio...");
      router.push(`/studio/${projectId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Project creation error";
      console.error("Create project error:", err);
      alert(message);
      setIsCreating(false);
      setCreationStep("");
    }
  };

  // Launch Canonical Demo Track in 1 click
  const handleLaunchCanonicalDemo = async () => {
    try {
      setIsCreating(true);
      setCreationStep("Synthesizing 20-second canonical audio track (5 lines, intro, 2 breaks, outro)...");

      const demoLyrics = `Yeah
Welcome to the sound of the city
Neon lights are shining bright
Walking through the midnight air
Feel the rhythm in your heart`;

      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "City Lights (Canonical 5-Line Demo)",
          lyrics: demoLyrics,
          useDemoSong: true,
          settings: {
            language: "en",
            preRollMs: 40,
            postRollMs: 80,
            minInstrumentalMs: 250,
            absorbPolicy: "previous",
          },
        }),
      });

      const projData = await projRes.json();
      const projectId = projData.projectId;

      setCreationStep("Transcribing & Aligning canonical 8-clip structure...");
      await fetch(`/api/projects/${projectId}/transcribe`, { method: "POST" });
      await fetch(`/api/projects/${projectId}/align`, { method: "POST" });

      router.push(`/studio/${projectId}`);
    } catch (err) {
      console.error("Demo launch error:", err);
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setRecentProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Delete project error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-slate-950/50 to-slate-950 -z-10" />

      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Music className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                LyricSplit
                <span className="text-[11px] text-emerald-400 font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60">
                  DSP v2.0
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchCanonicalDemo}
              disabled={isCreating}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02]"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 fill-current stroke-none" />
              <span>Load Canonical 5-Line Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sample-accurate alignment with Whisper Large v3 Turbo + Llama 3.3 70B</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            Split songs into sample-perfect <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              lyric lines & instrumental gaps
            </span>
          </h1>

          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Upload your audio file and paste the official lyrics. LyricSplit performs deterministic Needleman–Wunsch alignment, zero-crossing boundary polish, and exports clean, non-overlapping clips in a structured ZIP.
          </p>
        </section>

        {/* Project Ingest Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Loading Overlay */}
          {isCreating && (
            <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Processing Song Pipeline</h3>
                <p className="text-xs text-slate-400 font-mono max-w-md">{creationStep}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateProject} className="space-y-6">
            {/* Row 1: Title & Language */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Track / Project Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bohemian Rhapsody"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Language Hint
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="en">English (en)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="fr">French (fr)</option>
                  <option value="de">German (de)</option>
                  <option value="ja">Japanese (ja)</option>
                  <option value="ko">Korean (ko)</option>
                  <option value="it">Italian (it)</option>
                  <option value="pt">Portuguese (pt)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Audio Upload Dropzone & Lyrics Editor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audio Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Song Audio (Mix)</span>
                  <span className="text-[11px] text-slate-500 font-normal">WAV, MP3, FLAC, M4A, OGG</span>
                </label>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleAudioDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center transition-all ${
                    audioFile
                      ? "border-emerald-500/60 bg-emerald-950/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="file"
                    id="audio-upload"
                    accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a,.webm"
                    onChange={handleAudioFileInput}
                    className="hidden"
                  />

                  {audioFile ? (
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white truncate max-w-xs">{audioFile.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                      <label
                        htmlFor="audio-upload"
                        className="inline-block text-[11px] text-emerald-400 hover:underline cursor-pointer pt-1"
                      >
                        Change file
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="audio-upload" className="cursor-pointer space-y-2 block">
                      <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        Drag and drop audio track here, or <span className="text-emerald-400">browse</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Leave blank to use the built-in 20-second synthetic audio track
                      </p>
                    </label>
                  )}
                </div>

                {/* Optional Instrumental Stem */}
                <div className="pt-2">
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Optional: Upload Instrumental Stem (for enhanced gap subtraction)
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setInstrumentalFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              {/* Lyrics Paste / Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    2. Official Lyrics
                  </label>
                  <label className="text-[11px] text-emerald-400 hover:underline cursor-pointer flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>Upload .txt or .lrc</span>
                    <input
                      type="file"
                      accept=".txt,.lrc"
                      onChange={handleLyricsFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={8}
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Paste official lyrics here (one line per sung phrase)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>{showAdvanced ? "Hide Advanced DSP Alignment Settings" : "Configure Alignment & Pre/Post Roll Settings"}</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Pre-Roll (ms)</label>
                    <input
                      type="number"
                      value={preRollMs}
                      onChange={(e) => setPreRollMs(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Lead-in before onset</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Post-Roll (ms)</label>
                    <input
                      type="number"
                      value={postRollMs}
                      onChange={(e) => setPostRollMs(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Reverb tail room</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Min Gap (ms)</label>
                    <input
                      type="number"
                      value={minInstrumentalMs}
                      onChange={(e) => setMinInstrumentalMs(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Threshold to emit gap file</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Absorb Short Gaps</label>
                    <select
                      value={absorbPolicy}
                      onChange={(e) => setAbsorbPolicy(e.target.value as "previous" | "next" | "split")}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="previous">Into Previous Line</option>
                      <option value="next">Into Next Line</option>
                      <option value="split">Split Evenly</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="w-5 h-5 animate-spin stroke-[2.5]" />
                ) : (
                  <Sparkles className="w-5 h-5 stroke-[2.5]" />
                )}
                <span>Align & Launch Studio</span>
              </button>
            </div>
          </form>
        </div>

        {/* Canonical Example Explanation Section */}
        <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Canonical Split Pipeline Specification</span>
          </div>

          <h2 className="text-xl font-bold text-white">How 5 lyric lines become 8 exported clips:</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs text-slate-300">
            <div className="space-y-2">
              <p className="leading-relaxed">
                A 5-line song with an instrumental intro, two mid-song instrumental breaks, and an outro produces exactly 8 perfectly cut audio files:
              </p>
              <div className="font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 space-y-1 text-[11px]">
                <div className="text-purple-400">00_instrumental_intro.wav</div>
                <div className="text-emerald-400">01_line_01_yeah.wav</div>
                <div className="text-amber-400">02_instrumental_gap_01.wav</div>
                <div className="text-emerald-400">03_line_02_neon_lights.wav</div>
                <div className="text-emerald-400">04_line_03_walking_through.wav</div>
                <div className="text-amber-400">05_instrumental_gap_02.wav</div>
                <div className="text-emerald-400">06_line_04_feel_the_rhythm.wav</div>
                <div className="text-pink-400">07_instrumental_outro.wav</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  <strong>Sample-Accurate Slicing:</strong> Integer sample index offsets derived directly from source sample rate (44.1k / 48k).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  <strong>Zero-Crossing & RMS Polishing:</strong> Slices snap to energy minima so there are zero clicks, pops, or clipped syllables.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  <strong>Full DAW Studio:</strong> 100-step Immer undo/redo history, sample-accurate Web Audio clock, and live waveform canvas.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Projects List */}
        {recentProjects.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Recent Studio Projects ({recentProjects.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/studio/${p.id}`)}
                  className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer group transition-all hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                      {p.title}
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="capitalize text-emerald-400">{p.status}</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
