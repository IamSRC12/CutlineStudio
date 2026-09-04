"use client";

import React from "react";
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Radio,
} from "lucide-react";
import { Region } from "@/shared/schema";

interface TransportBarProps {
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  sampleRate: number;
  isLooping: boolean;
  playbackRate: number;
  volume: number;
  selectedRegion: Region | null;
  onPlayPause: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetVolume: (vol: number) => void;
  onNudge: (deltaMs: number) => void;
  onSoloRegion: (region: Region) => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  currentTimeSec,
  durationSec,
  sampleRate,
  isLooping,
  playbackRate,
  volume,
  selectedRegion,
  onPlayPause,
  onStop,
  onToggleLoop,
  onSetPlaybackRate,
  onSetVolume,
  onNudge,
  onSoloRegion,
}) => {
  const formatTime = (timeSec: number) => {
    const total = Math.max(0, timeSec);
    const min = Math.floor(total / 60);
    const sec = Math.floor(total % 60);
    const ms = Math.floor((total % 1) * 1000);
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(
      3,
      "0"
    )}`;
  };

  const currentSample = Math.round(currentTimeSec * sampleRate);
  const totalSamples = Math.round(durationSec * sampleRate);

  return (
    <div className="h-16 border-t border-slate-800/90 bg-slate-950 px-4 flex items-center justify-between select-none z-10">
      {/* Left: Time & Sample Readout */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col font-mono">
          <div className="flex items-baseline gap-1 text-slate-100">
            <span className="text-lg font-bold tracking-tight text-white">
              {formatTime(currentTimeSec)}
            </span>
            <span className="text-xs text-slate-500 font-normal">
              / {formatTime(durationSec)}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            <span className="text-emerald-400">{currentSample.toLocaleString()}</span> / {totalSamples.toLocaleString()} samples
          </div>
        </div>

        {selectedRegion && (
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
            <button
              onClick={() => onSoloRegion(selectedRegion)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 text-xs transition-colors"
            >
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>Solo Clip</span>
            </button>
            <span className="text-xs text-slate-400 font-mono">
              Δ {((selectedRegion.end - selectedRegion.start) * 1000).toFixed(0)} ms
            </span>
          </div>
        )}
      </div>

      {/* Center: Transport Controls & Nudge */}
      <div className="flex items-center gap-2">
        {/* Micro Nudge Left */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onNudge(-10)}
            disabled={!selectedRegion}
            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded text-xs font-mono transition-colors"
            title="Nudge boundary -10 ms ([)"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNudge(-1)}
            disabled={!selectedRegion}
            className="px-1.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded text-[10px] font-mono transition-colors"
            title="Nudge boundary -1 ms (Shift+[)"
          >
            -1ms
          </button>
        </div>

        {/* Play/Pause Main */}
        <button
          onClick={onPlayPause}
          className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-transform active:scale-95"
          title="Play / Pause (Space)"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current stroke-none" />
          ) : (
            <Play className="w-5 h-5 fill-current stroke-none ml-0.5" />
          )}
        </button>

        {/* Stop */}
        <button
          onClick={onStop}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Loop */}
        <button
          onClick={onToggleLoop}
          className={`p-2 rounded-lg transition-colors ${
            isLooping
              ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
          title="Loop Region (L)"
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Micro Nudge Right */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onNudge(1)}
            disabled={!selectedRegion}
            className="px-1.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded text-[10px] font-mono transition-colors"
            title="Nudge boundary +1 ms (Shift+])"
          >
            +1ms
          </button>
          <button
            onClick={() => onNudge(10)}
            disabled={!selectedRegion}
            className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded text-xs font-mono transition-colors"
            title="Nudge boundary +10 ms (])"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: Rate & Volume */}
      <div className="flex items-center gap-3">
        {/* Playback Rate */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => onSetPlaybackRate(rate)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                playbackRate === rate
                  ? "bg-slate-700 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetVolume(volume > 0 ? 0 : 1.0)}
            className="text-slate-400 hover:text-white transition-colors"
            title="Mute / Unmute"
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={volume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            className="w-16 accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
