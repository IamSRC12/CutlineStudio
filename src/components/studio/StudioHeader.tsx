"use client";

import React, { useState } from "react";
import {
  Undo2,
  Redo2,
  Settings as SettingsIcon,
  Download,
  Sparkles,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HelpCircle,
  Music,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { Project, ProjectStatus } from "@/shared/schema";

interface StudioHeaderProps {
  project: Project;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateTitle: (title: string) => void;
  onRunTranscribe: () => void;
  onRunAlign: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  isTranscribing: boolean;
  isAligning: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  project,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateTitle,
  onRunTranscribe,
  onRunAlign,
  onOpenSettings,
  onOpenExport,
  onOpenShortcuts,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  isTranscribing,
  isAligning,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(project.title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleText.trim() && titleText !== project.title) {
      onUpdateTitle(titleText.trim());
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    if (isTranscribing || status === "transcribing") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Whisper Transcribing...</span>
        </div>
      );
    }
    if (isAligning || status === "aligning") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Reconciling & Aligning...</span>
        </div>
      );
    }
    if (status === "ready") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          <span>Aligned & Polished</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
        <Clock className="w-3 h-3" />
        <span>Draft</span>
      </div>
    );
  };

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur px-4 flex items-center justify-between select-none z-20">
      {/* Left: Brand & Title */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 group mr-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Music className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1">
              LyricSplit <span className="text-[10px] text-emerald-400 font-mono font-normal px-1 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50">STUDIO</span>
            </span>
          </div>
        </a>

        <div className="h-4 w-px bg-slate-800" />

        {/* Project Title */}
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="bg-slate-900 border border-emerald-500/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-xs font-semibold text-slate-200 hover:text-white px-2 py-1 rounded hover:bg-slate-800/60 transition-colors flex items-center gap-1.5 max-w-[200px] truncate"
              title="Click to rename project"
            >
              <span className="truncate">{project.title}</span>
            </button>
          )}

          {getStatusBadge(project.status)}
        </div>
      </div>

      {/* Center: Undo/Redo & Zoom */}
      <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 rounded-lg p-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
          title="Undo (Ctrl+Z / ⌘Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
          title="Redo (Ctrl+Shift+Z / ⌘Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <button
          onClick={onZoomIn}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomFit}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fit Track to Window (0)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunTranscribe}
          disabled={isTranscribing || isAligning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors disabled:opacity-50"
          title="Run Whisper Large v3 Turbo Word Timestamp ASR"
        >
          {isTranscribing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>Transcribe</span>
        </button>

        <button
          onClick={onRunAlign}
          disabled={isTranscribing || isAligning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700/50 rounded-lg transition-colors disabled:opacity-50"
          title="Reconcile with Llama 3.3 70B & Align with Needleman-Wunsch"
        >
          {isAligning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span>Re-Align</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg transition-colors"
          title="Project Settings (Pre-roll, Post-roll, Gap Threshold)"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenShortcuts}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg transition-colors"
          title="Keyboard Shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-md shadow-emerald-500/20 rounded-lg transition-all"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Export ZIP</span>
        </button>
      </div>
    </header>
  );
};
