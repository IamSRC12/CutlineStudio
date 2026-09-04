"use client";

import React, { useState } from "react";
import { Document, Region, Line } from "@/shared/schema";
import {
  Play,
  Download,
  EyeOff,
  Eye,
  Music,
  Radio,
  FileText,
  Volume2,
} from "lucide-react";

interface RegionListProps {
  document: Document;
  selectedRegionId: string | null;
  currentTimeSec: number;
  onSelectRegion: (regionId: string) => void;
  onSoloRegion: (region: Region) => void;
  onToggleSkip: (regionId: string) => void;
  onDownloadSingleClip: (region: Region) => void;
}

export const RegionList: React.FC<RegionListProps> = ({
  document,
  selectedRegionId,
  currentTimeSec,
  onSelectRegion,
  onSoloRegion,
  onToggleSkip,
  onDownloadSingleClip,
}) => {
  const [filter, setFilter] = useState<"all" | "line" | "gap" | "intro_outro">("all");

  const lineMap = new Map<string, Line>();
  for (const l of document.lines) {
    lineMap.set(l.id, l);
  }

  const filteredRegions = document.regions.filter((r) => {
    if (filter === "line") return r.kind === "line";
    if (filter === "gap") return r.kind === "instrumental_gap";
    if (filter === "intro_outro")
      return r.kind === "instrumental_intro" || r.kind === "instrumental_outro";
    return true;
  });

  const getKindBadge = (kind: Region["kind"]) => {
    switch (kind) {
      case "line":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Lyric
          </span>
        );
      case "instrumental_intro":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
            Intro
          </span>
        );
      case "instrumental_gap":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Break
          </span>
        );
      case "instrumental_outro":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-500/15 text-pink-400 border border-pink-500/30">
            Outro
          </span>
        );
    }
  };

  return (
    <aside className="w-80 h-full border-r border-slate-800/80 bg-slate-950 flex flex-col select-none">
      {/* Header & Filter */}
      <div className="p-3 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Music className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Clips ({document.regions.length})
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            {document.regions.filter((r) => !r.skip).length} active
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          {(
            [
              { key: "all", label: "All" },
              { key: "line", label: "Lyrics" },
              { key: "gap", label: "Gaps" },
              { key: "intro_outro", label: "Intro/Outro" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === item.key
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Region Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-2 space-y-1">
        {filteredRegions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No clips match the selected filter.
          </div>
        ) : (
          filteredRegions.map((region) => {
            const isSelected = region.id === selectedRegionId;
            const isCurrent = currentTimeSec >= region.start && currentTimeSec <= region.end;
            const matchedLine = region.lineId ? lineMap.get(region.lineId) : null;
            const durationMs = ((region.end - region.start) * 1000).toFixed(0);

            return (
              <div
                key={region.id}
                onClick={() => onSelectRegion(region.id)}
                className={`group relative rounded-lg p-2.5 transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-slate-900/90 border-emerald-500/60 shadow-md shadow-emerald-500/5"
                    : isCurrent
                    ? "bg-slate-900/40 border-slate-700/80"
                    : "bg-slate-950/40 border-transparent hover:bg-slate-900/40 hover:border-slate-800/80"
                } ${region.skip ? "opacity-50" : ""}`}
              >
                {/* Header row: Index, Kind, Solo, Skip, Download */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-500 font-bold">
                      {String(region.index).padStart(2, "0")}
                    </span>
                    {getKindBadge(region.kind)}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    {/* Solo Play */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSoloRegion(region);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                      title="Solo Preview Clip"
                    >
                      <Play className="w-3.5 h-3.5 fill-current stroke-none" />
                    </button>

                    {/* Skip Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSkip(region.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        region.skip
                          ? "text-amber-400 hover:bg-slate-800"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      }`}
                      title={region.skip ? "Include in export" : "Exclude (Skip) from export"}
                    >
                      {region.skip ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    {/* Single Download */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadSingleClip(region);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                      title="Download Single Clip (.wav)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Body: Lyric Text or Gap Description */}
                <div className="text-xs text-slate-200 font-medium truncate mb-1.5">
                  {region.kind === "line" && matchedLine ? (
                    matchedLine.text
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px]">{region.label}</span>
                  )}
                </div>

                {/* Footer: Start, End, Duration */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>
                    {region.start.toFixed(3)}s → {region.end.toFixed(3)}s
                  </span>
                  <span className="text-slate-400">{durationMs} ms</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
