"use client";

import React from "react";
import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Space", desc: "Play / Pause playback" },
    { key: "[", desc: "Nudge selected boundary -10 ms" },
    { key: "]", desc: "Nudge selected boundary +10 ms" },
    { key: "Shift + [", desc: "Nudge selected boundary -1 ms (sample micro-step)" },
    { key: "Shift + ]", desc: "Nudge selected boundary +1 ms (sample micro-step)" },
    { key: "L", desc: "Toggle loop mode on selected clip" },
    { key: "Ctrl + Z / ⌘Z", desc: "Undo edit (100-step history)" },
    { key: "Ctrl + Shift + Z / ⌘Shift+Z", desc: "Redo edit" },
    { key: "+ / =", desc: "Zoom in timeline" },
    { key: "-", desc: "Zoom out timeline" },
    { key: "0", desc: "Fit entire song in timeline view" },
    { key: "Double Click Clip", desc: "Solo preview clip from start to end" },
    { key: "Escape", desc: "Deselect region" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Studio Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 text-xs overflow-y-auto max-h-[60vh]">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0"
            >
              <span className="text-slate-300 font-medium">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
