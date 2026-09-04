"use client";

import React, { useState, useEffect } from "react";
import { Document, Region, Line, WhisperWord } from "@/shared/schema";
import {
  Sliders,
  FileText,
  RotateCcw,
  Scissors,
  Merge,
  EyeOff,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";

interface InspectorPanelProps {
  document: Document;
  selectedRegion: Region | null;
  sampleRate: number;
  onSetRegionTimes: (regionId: string, start: number, end: number) => void;
  onUpdateLineText: (lineId: string, text: string) => void;
  onResetPolish: (regionId?: string) => void;
  onToggleSkip: (regionId: string) => void;
  onSplitLine: (lineId: string, wordIndex: number) => void;
  onMergeLines: (firstLineId: string, secondLineId: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  document,
  selectedRegion,
  sampleRate,
  onSetRegionTimes,
  onUpdateLineText,
  onResetPolish,
  onToggleSkip,
  onSplitLine,
  onMergeLines,
}) => {
  const [tab, setTab] = useState<"inspector" | "lyrics">("inspector");

  const [startInput, setStartInput] = useState<string>("");
  const [endInput, setEndInput] = useState<string>("");
  const [lineTextInput, setLineTextInput] = useState<string>("");

  const lineMap = new Map<string, Line>();
  for (const l of document.lines) {
    lineMap.set(l.id, l);
  }

  const wordMap = new Map<string, WhisperWord>();
  for (const w of document.words) {
    wordMap.set(w.id, w);
  }

  const matchedLine = selectedRegion?.lineId ? lineMap.get(selectedRegion.lineId) : null;

  useEffect(() => {
    if (selectedRegion) {
      setStartInput((selectedRegion.start * 1000).toFixed(0));
      setEndInput((selectedRegion.end * 1000).toFixed(0));
    }
    if (matchedLine) {
      setLineTextInput(matchedLine.text);
    }
  }, [selectedRegion, matchedLine]);

  const handleApplyTimes = () => {
    if (!selectedRegion) return;
    const startSec = parseFloat(startInput) / 1000;
    const endSec = parseFloat(endInput) / 1000;
    if (!isNaN(startSec) && !isNaN(endSec) && endSec > startSec) {
      onSetRegionTimes(selectedRegion.id, startSec, endSec);
    }
  };

  const handleApplyLineText = () => {
    if (matchedLine && lineTextInput.trim() && lineTextInput !== matchedLine.text) {
      onUpdateLineText(matchedLine.id, lineTextInput.trim());
    }
  };

  const alignedWords = matchedLine?.wordIds?.map((id) => wordMap.get(id)).filter(Boolean) as WhisperWord[] || [];

  return (
    <aside className="w-80 h-full border-l border-slate-800/80 bg-slate-950 flex flex-col select-none">
      {/* Tabs Header */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 w-full text-xs">
          <button
            onClick={() => setTab("inspector")}
            className={`flex-1 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === "inspector" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Inspector</span>
          </button>
          <button
            onClick={() => setTab("lyrics")}
            className={`flex-1 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === "lyrics" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Full Sheet</span>
          </button>
        </div>
      </div>

      {tab === "inspector" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedRegion ? (
            <>
              {/* Header Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Selected Region
                  </span>
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    #{String(selectedRegion.index).padStart(2, "0")}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white truncate font-mono">
                  {selectedRegion.label}
                </div>
              </div>

              {/* Timing Controls */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Boundaries (ms)</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Δ {((selectedRegion.end - selectedRegion.start) * 1000).toFixed(0)} ms
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 font-mono">Start (ms)</label>
                    <input
                      type="number"
                      value={startInput}
                      onChange={(e) => setStartInput(e.target.value)}
                      onBlur={handleApplyTimes}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyTimes()}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 font-mono">End (ms)</label>
                    <input
                      type="number"
                      value={endInput}
                      onChange={(e) => setEndInput(e.target.value)}
                      onBlur={handleApplyTimes}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyTimes()}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-mono flex justify-between pt-1 border-t border-slate-800">
                  <span>Samples: {Math.round(selectedRegion.start * sampleRate)}</span>
                  <span>→ {Math.round(selectedRegion.end * sampleRate)}</span>
                </div>
              </div>

              {/* Lyric Line Editor */}
              {matchedLine && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Official Line Text</label>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {(matchedLine.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={lineTextInput}
                    onChange={(e) => setLineTextInput(e.target.value)}
                    onBlur={handleApplyLineText}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              )}

              {/* Aligned Words Breakdown */}
              {alignedWords.length > 0 && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Whisper Word Alignment</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {alignedWords.map((w, wIdx) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between text-[11px] bg-slate-950/70 p-1.5 rounded border border-slate-800/80"
                      >
                        <span className="font-medium text-slate-200">{w.word}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500">
                            {w.start.toFixed(2)}s - {w.end.toFixed(2)}s
                          </span>
                          {wIdx > 0 && matchedLine && (
                            <button
                              onClick={() => onSplitLine(matchedLine.id, wIdx)}
                              className="text-slate-500 hover:text-cyan-400 p-0.5"
                              title={`Split line before "${w.word}"`}
                            >
                              <Scissors className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => onToggleSkip(selectedRegion.id)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors"
                >
                  {selectedRegion.skip ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{selectedRegion.skip ? "Un-skip (Include in Export)" : "Skip (Exclude from Export)"}</span>
                </button>

                <button
                  onClick={() => onResetPolish(selectedRegion.id)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Reset to raw Whisper word timestamp core"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Raw Word Timestamps</span>
                </button>
              </div>
            </>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs p-4">
              <Sliders className="w-8 h-8 text-slate-700 mb-2" />
              <span>Select any clip or region on the timeline to inspect and edit boundaries.</span>
            </div>
          )}
        </div>
      ) : (
        /* Full Sheet View */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Aligned Lyric Lines ({document.lines.length})
          </div>
          {document.lines.map((line, idx) => (
            <div
              key={line.id}
              className={`p-2.5 rounded-lg border text-xs transition-colors ${
                selectedRegion?.lineId === line.id
                  ? "bg-emerald-950/40 border-emerald-500/60 text-white"
                  : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-slate-500">Line {idx + 1}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {line.start.toFixed(2)}s → {line.end.toFixed(2)}s
                </span>
              </div>
              <div className="font-medium text-slate-100">{line.text}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
