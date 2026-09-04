"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Project, Document, Region, ProjectSettings, EditOperation } from "@/shared/schema";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { WaveformCanvas } from "@/components/studio/WaveformCanvas";
import { TransportBar } from "@/components/studio/TransportBar";
import { RegionList } from "@/components/studio/RegionList";
import { InspectorPanel } from "@/components/studio/InspectorPanel";
import { SettingsModal } from "@/components/studio/SettingsModal";
import { ExportModal } from "@/components/studio/ExportModal";
import { KeyboardShortcutsModal } from "@/components/studio/KeyboardShortcutsModal";
import { StudioAudioEngine, computeWaveformPeaks } from "@/lib/client/audio-engine";
import { applyDocumentOperation } from "@/lib/state/document-reducer";
import { saveCrashMirror, cacheWaveformPeaks, getCachedWaveformPeaks } from "@/lib/client/indexeddb";
import { slicePcm, encodeWav } from "@/lib/audio/slice";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";

export default function StudioPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) || "";

  const [project, setProject] = useState<Project | null>(null);
  const [studioDoc, setStudioDoc] = useState<Document | null>(null);
  const [history, setHistory] = useState<Document[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<Float32Array | null>(null);
  const [durationSec, setDurationSec] = useState<number>(30);
  const [sampleRate, setSampleRate] = useState<number>(44100);

  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>({ start: 0, end: 30 });

  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);

  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isAligning, setIsAligning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  const audioEngineRef = useRef<StudioAudioEngine | null>(null);

  // Initialize Audio Engine once
  if (!audioEngineRef.current) {
    audioEngineRef.current = new StudioAudioEngine();
  }

  // Load project & assets
  const loadProjectData = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(`Failed to load project (${res.status})`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Project load failed");

      setProject(data.project);
      setStudioDoc(data.document);

      // Initialize history with initial document
      setHistory([data.document]);
      setHistoryIndex(0);

      // Check if project has mix audio
      const audioRes = await fetch(`/api/projects/${id}/audio`);
      if (audioRes.ok) {
        const arrayBuf = await audioRes.arrayBuffer();
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtxClass();
        const decoded = await ctx.decodeAudioData(arrayBuf);

        audioEngineRef.current?.setAudioBuffer(decoded);
        setAudioBuffer(decoded);
        setDurationSec(decoded.duration);
        setSampleRate(decoded.sampleRate);
        setViewRange({ start: 0, end: Math.min(decoded.duration, 30) });

        // Compute peaks
        const peaks = computeWaveformPeaks(decoded, 2000);
        setWaveformPeaks(peaks);
      } else {
        setDurationSec(30);
        setViewRange({ start: 0, end: 30 });
      }

      setIsLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load project";
      console.error("Load project error:", err);
      setErrorMsg(message);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      loadProjectData(projectId);
    }
  }, [projectId, loadProjectData]);

  // Audio Engine time subscription
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    const unsubscribe = engine.subscribe((t, playing) => {
      setCurrentTimeSec(t);
      setIsPlaying(playing);
    });

    return () => unsubscribe();
  }, []);

  // Save to DB and mirror to IndexedDB
  const persistDocument = useCallback(
    async (newDoc: Document) => {
      if (!projectId || !project) return;
      saveCrashMirror(projectId, newDoc, project.settings);

      try {
        await fetch(`/api/projects/${projectId}/document`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: newDoc }),
        });
      } catch (err) {
        console.warn("Failed to persist document to server:", err);
      }
    },
    [projectId, project]
  );

  // Dispatch Edit Operation with Immer 100-step history
  const dispatchOperation = useCallback(
    (op: EditOperation) => {
      if (!studioDoc || !project) return;

      const nextDoc = applyDocumentOperation(
        studioDoc,
        op,
        project.settings,
        durationSec,
        sampleRate
      );

      // Truncate future history if branched and push new state
      const nextHistory = history.slice(0, historyIndex + 1);
      if (nextHistory.length >= 100) {
        nextHistory.shift();
      }
      nextHistory.push(nextDoc);

      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
      setStudioDoc(nextDoc);

      persistDocument(nextDoc);
    },
    [studioDoc, project, history, historyIndex, durationSec, sampleRate, persistDocument]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevDoc = history[prevIndex];
      setHistoryIndex(prevIndex);
      setStudioDoc(prevDoc);
      persistDocument(prevDoc);
    }
  }, [history, historyIndex, persistDocument]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextDoc = history[nextIndex];
      setHistoryIndex(nextIndex);
      setStudioDoc(nextDoc);
      persistDocument(nextDoc);
    }
  }, [history, historyIndex, persistDocument]);

  // Selected Region
  const selectedRegion = studioDoc?.regions.find((r) => r.id === selectedRegionId) || null;

  // Solo Play Region
  const handleSoloRegion = useCallback(
    (region: Region) => {
      setSelectedRegionId(region.id);
      audioEngineRef.current?.play(region.start, { start: region.start, end: region.end });
    },
    []
  );

  // Transport handlers
  const handlePlayPause = useCallback(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    if (isPlaying) {
      engine.pause();
    } else {
      if (selectedRegion && isLooping) {
        engine.play(selectedRegion.start, { start: selectedRegion.start, end: selectedRegion.end });
      } else {
        engine.play(currentTimeSec);
      }
    }
  }, [isPlaying, selectedRegion, isLooping, currentTimeSec]);

  const handleStop = useCallback(() => {
    audioEngineRef.current?.stop();
    audioEngineRef.current?.seek(0);
  }, []);

  const handleSeek = useCallback((t: number) => {
    audioEngineRef.current?.seek(t);
  }, []);

  const handleToggleLoop = useCallback(() => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (selectedRegion) {
      audioEngineRef.current?.setLoop(nextLoop, { start: selectedRegion.start, end: selectedRegion.end });
    } else {
      audioEngineRef.current?.setLoop(nextLoop, null);
    }
  }, [isLooping, selectedRegion]);

  const handleSetPlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    audioEngineRef.current?.setPlaybackRate(rate);
  }, []);

  const handleSetVolume = useCallback((vol: number) => {
    setVolume(vol);
    audioEngineRef.current?.setVolume(vol);
  }, []);

  // Nudge boundary by delta ms
  const handleNudgeDelta = useCallback(
    (deltaMs: number) => {
      if (!selectedRegion) return;
      const deltaSec = deltaMs / 1000;
      dispatchOperation({
        type: "NUDGE_REGION",
        regionId: selectedRegion.id,
        deltaStartSec: deltaSec,
        deltaEndSec: deltaSec,
        ripple: false,
      });
    },
    [selectedRegion, dispatchOperation]
  );

  const handleNudgeBoundaryDirect = useCallback(
    (regionId: string, boundary: "start" | "end", newTimeSec: number) => {
      const region = studioDoc?.regions.find((r) => r.id === regionId);
      if (!region) return;

      const newStart = boundary === "start" ? newTimeSec : region.start;
      const newEnd = boundary === "end" ? newTimeSec : region.end;

      if (newEnd > newStart) {
        dispatchOperation({
          type: "SET_REGION_TIMES",
          regionId,
          start: newStart,
          end: newEnd,
        });
      }
    },
    [studioDoc, dispatchOperation]
  );

  // Download Single Clip directly as WAV
  const handleDownloadSingleClip = useCallback(
    (region: Region) => {
      if (!audioBuffer) return;

      const startSample = region.startSample ?? Math.round(region.start * sampleRate);
      const endSample = region.endSample ?? Math.round(region.end * sampleRate);

      const left = slicePcm(audioBuffer.getChannelData(0), startSample, endSample);
      const right =
        audioBuffer.numberOfChannels > 1
          ? slicePcm(audioBuffer.getChannelData(1), startSample, endSample)
          : left;

      const wavBytes = encodeWav([left, right], sampleRate, 16);
      const blob = new Blob([wavBytes as unknown as BlobPart], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${region.label}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [audioBuffer, sampleRate]
  );

  // Server Export ZIP
  const handleDownloadZip = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/export`, { method: "POST" });
    if (!res.ok) throw new Error("ZIP export failed on server");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${(project?.title || "lyricsplit").toLowerCase().replace(/[^a-z0-9]/g, "_")}_clips.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectId, project]);

  // Transcribe ASR
  const handleRunTranscribe = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsTranscribing(true);
      const res = await fetch(`/api/projects/${projectId}/transcribe`, { method: "POST" });
      const data = await res.json();
      if (data.success && data.words) {
        if (studioDoc) {
          const updatedDoc = { ...studioDoc, words: data.words };
          setStudioDoc(updatedDoc);
        }
      }
      setIsTranscribing(false);
    } catch (err) {
      console.error("Transcribe failed:", err);
      setIsTranscribing(false);
    }
  }, [projectId, studioDoc]);

  // Re-Align
  const handleRunAlign = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsAligning(true);
      const res = await fetch(`/api/projects/${projectId}/align`, { method: "POST" });
      const data = await res.json();
      if (data.success && data.lines && data.regions) {
        if (studioDoc) {
          const updatedDoc = {
            ...studioDoc,
            lines: data.lines,
            regions: data.regions,
            alignmentTrace: data.alignmentTrace,
          };
          setStudioDoc(updatedDoc);
          setHistory((prev) => [...prev, updatedDoc]);
          setHistoryIndex((prev) => prev + 1);
        }
      }
      setIsAligning(false);
    } catch (err) {
      console.error("Align failed:", err);
      setIsAligning(false);
    }
  }, [projectId, studioDoc]);

  // Update settings
  const handleSaveSettings = useCallback(
    async (newSettings: ProjectSettings) => {
      if (!projectId || !project) return;
      setProject({ ...project, settings: newSettings });

      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: newSettings }),
        });

        dispatchOperation({
          type: "RECALCULATE_GAPS",
          minInstrumentalMs: newSettings.minInstrumentalMs,
          absorbPolicy: newSettings.absorbPolicy,
        });
      } catch (err) {
        console.error("Failed to update settings:", err);
      }
    },
    [projectId, project, dispatchOperation]
  );

  // Update Title
  const handleUpdateTitle = useCallback(
    async (newTitle: string) => {
      if (!projectId || !project) return;
      setProject({ ...project, title: newTitle });

      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
      } catch (err) {
        console.error("Failed to update title:", err);
      }
    },
    [projectId, project]
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const curDur = viewRange.end - viewRange.start;
    const newDur = Math.max(1.0, curDur * 0.7);
    const mid = (viewRange.start + viewRange.end) / 2;
    setViewRange({
      start: Math.max(0, mid - newDur / 2),
      end: Math.min(durationSec, mid + newDur / 2),
    });
  }, [viewRange, durationSec]);

  const handleZoomOut = useCallback(() => {
    const curDur = viewRange.end - viewRange.start;
    const newDur = Math.min(durationSec, curDur * 1.4);
    const mid = (viewRange.start + viewRange.end) / 2;
    setViewRange({
      start: Math.max(0, mid - newDur / 2),
      end: Math.min(durationSec, mid + newDur / 2),
    });
  }, [viewRange, durationSec]);

  const handleZoomFit = useCallback(() => {
    setViewRange({ start: 0, end: durationSec || 30 });
  }, [durationSec]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = window.document.activeElement;
      if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === "BracketLeft") {
        e.preventDefault();
        handleNudgeDelta(e.shiftKey ? -1 : -10);
      } else if (e.code === "BracketRight") {
        e.preventDefault();
        handleNudgeDelta(e.shiftKey ? 1 : 10);
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRedo();
      } else if (e.code === "KeyL") {
        e.preventDefault();
        handleToggleLoop();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        handleZoomFit();
      } else if (e.code === "Escape") {
        setSelectedRegionId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handlePlayPause,
    handleNudgeDelta,
    handleUndo,
    handleRedo,
    handleToggleLoop,
    handleZoomIn,
    handleZoomOut,
    handleZoomFit,
  ]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-sm font-semibold tracking-wide">Loading LyricSplit Studio...</span>
      </div>
    );
  }

  if (errorMsg || !project || !studioDoc) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h1 className="text-lg font-bold text-white mb-1">Project Load Error</h1>
        <p className="text-xs text-slate-400 max-w-md mb-6">{errorMsg || "Unable to find project."}</p>
        <a
          href="/"
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100 font-sans select-none">
      {/* 1. Header */}
      <StudioHeader
        project={project}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onUpdateTitle={handleUpdateTitle}
        onRunTranscribe={handleRunTranscribe}
        onRunAlign={handleRunAlign}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        isTranscribing={isTranscribing}
        isAligning={isAligning}
      />

      {/* 2. Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Clips List */}
        <RegionList
          document={studioDoc}
          selectedRegionId={selectedRegionId}
          currentTimeSec={currentTimeSec}
          onSelectRegion={(id) => setSelectedRegionId(id)}
          onSoloRegion={handleSoloRegion}
          onToggleSkip={(id) => dispatchOperation({ type: "TOGGLE_SKIP_REGION", regionId: id })}
          onDownloadSingleClip={handleDownloadSingleClip}
        />

        {/* Center Timeline Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          <div className="flex-1 relative">
            <WaveformCanvas
              document={studioDoc}
              currentTimeSec={currentTimeSec}
              durationSec={durationSec}
              waveformPeaks={waveformPeaks}
              selectedRegionId={selectedRegionId}
              onSelectRegion={(id) => setSelectedRegionId(id)}
              onSeek={handleSeek}
              onSoloRegion={handleSoloRegion}
              onNudgeBoundary={handleNudgeBoundaryDirect}
              viewRange={viewRange}
              onViewRangeChange={setViewRange}
              loopRegion={
                selectedRegion && isLooping
                  ? { start: selectedRegion.start, end: selectedRegion.end }
                  : null
              }
              isLooping={isLooping}
            />
          </div>
        </div>

        {/* Right Inspector & Lyrics Panel */}
        <InspectorPanel
          document={studioDoc}
          selectedRegion={selectedRegion}
          sampleRate={sampleRate}
          onSetRegionTimes={(regionId, start, end) =>
            dispatchOperation({ type: "SET_REGION_TIMES", regionId, start, end })
          }
          onUpdateLineText={(lineId, text) =>
            dispatchOperation({ type: "UPDATE_LINE_TEXT", lineId, newText: text })
          }
          onResetPolish={(regionId) => dispatchOperation({ type: "RESET_POLISH", regionId })}
          onToggleSkip={(regionId) => dispatchOperation({ type: "TOGGLE_SKIP_REGION", regionId })}
          onSplitLine={(lineId, wordIndex) =>
            dispatchOperation({ type: "SPLIT_LINE", lineId, splitWordIndex: wordIndex })
          }
          onMergeLines={(firstLineId, secondLineId) =>
            dispatchOperation({ type: "MERGE_LINES", firstLineId, secondLineId })
          }
        />
      </div>

      {/* 3. Transport Bar */}
      <TransportBar
        isPlaying={isPlaying}
        currentTimeSec={currentTimeSec}
        durationSec={durationSec}
        sampleRate={sampleRate}
        isLooping={isLooping}
        playbackRate={playbackRate}
        volume={volume}
        selectedRegion={selectedRegion}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onToggleLoop={handleToggleLoop}
        onSetPlaybackRate={handleSetPlaybackRate}
        onSetVolume={handleSetVolume}
        onNudge={handleNudgeDelta}
        onSoloRegion={handleSoloRegion}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={project.settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      <ExportModal
        isOpen={isExportOpen}
        project={project}
        document={studioDoc}
        sampleRate={sampleRate}
        durationSec={durationSec}
        onClose={() => setIsExportOpen(false)}
        onDownloadZip={handleDownloadZip}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
