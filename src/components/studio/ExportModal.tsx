"use client";

import React, { useState } from "react";
import { Project, Document } from "@/shared/schema";
import { X, Download, FileArchive, CheckCircle2, FileCode, Loader2 } from "lucide-react";
import { generateManifest, generateLrc } from "@/lib/export/manifest";

interface ExportModalProps {
  isOpen: boolean;
  project: Project;
  document: Document;
  sampleRate: number;
  durationSec: number;
  onClose: () => void;
  onDownloadZip: () => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  project,
  document,
  sampleRate,
  durationSec,
  onClose,
  onDownloadZip,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "manifest" | "lrc">("summary");

  if (!isOpen) return null;

  const manifest = generateManifest({
    project,
    document,
    sampleRate,
    durationSec,
    format: "wav",
  });

  const lrcContent = generateLrc(document, project.title);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await onDownloadZip();
      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error("Export download failed:", err);
      setIsExporting(false);
    }
  };

  const activeClipsCount = manifest.clips.filter((c) => !c.skip).length;
  const lyricClipsCount = manifest.clips.filter((c) => c.kind === "line" && !c.skip).length;
  const gapClipsCount = manifest.clips.filter(
    (c) => (c.kind === "instrumental_gap" || c.kind === "instrumental_intro" || c.kind === "instrumental_outro") && !c.skip
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Export Audio Clips & ZIP Package</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 border-b border-slate-800 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === "summary"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Package Summary ({activeClipsCount} Files)
          </button>
          <button
            onClick={() => setActiveTab("manifest")}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === "manifest"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            manifest.json
          </button>
          <button
            onClick={() => setActiveTab("lrc")}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === "lrc"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            lyrics.lrc
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-xs overflow-y-auto max-h-[60vh]">
          {activeTab === "summary" ? (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Total Clips</div>
                  <div className="text-xl font-bold text-white mt-1">{activeClipsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sample-accurate WAVs</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Lyric Lines</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{lyricClipsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Reconciled lines</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Instrumentals</div>
                  <div className="text-xl font-bold text-purple-400 mt-1">{gapClipsCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Intro, breaks & outro</div>
                </div>
              </div>

              {/* Canonical File Structure Preview */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                <div className="text-slate-400 text-[10px] font-sans font-bold uppercase mb-2">
                  Package Files
                </div>
                {manifest.clips.map((clip) => (
                  <div
                    key={clip.index}
                    className={`flex items-center justify-between ${
                      clip.skip ? "text-slate-600 line-through" : "text-slate-300"
                    }`}
                  >
                    <span className="truncate">{clip.filename}</span>
                    <span className="text-slate-500 text-[10px]">
                      {clip.durationSec.toFixed(3)}s ({clip.sampleCount.toLocaleString()} spls)
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-800 text-slate-400 flex justify-between">
                  <span>manifest.json</span>
                  <span className="text-emerald-400 text-[10px]">Metadata & Sample offsets</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>lyrics.lrc</span>
                  <span className="text-emerald-400 text-[10px]">Time-synced lyrics</span>
                </div>
              </div>
            </div>
          ) : activeTab === "manifest" ? (
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
              {JSON.stringify(manifest, null, 2)}
            </pre>
          ) : (
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
              {lrcContent || "# No lyric timestamps generated yet"}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-slate-400 text-xs">
            Output: <span className="font-mono text-white">16-bit Lossless WAV</span> @ {sampleRate} Hz
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isExporting || activeClipsCount === 0}
              onClick={handleExport}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-xs disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
              ) : (
                <Download className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>{isExporting ? "Generating ZIP..." : "Download ZIP Package"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
