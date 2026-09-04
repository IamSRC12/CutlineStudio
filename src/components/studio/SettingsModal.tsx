"use client";

import React, { useState } from "react";
import { ProjectSettings } from "@/shared/schema";
import { X, Sliders, Check } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  settings: ProjectSettings;
  onClose: () => void;
  onSave: (newSettings: ProjectSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<ProjectSettings>({ ...settings });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Project Alignment & DSP Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
          {/* Pre-Roll & Post-Roll */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">
                Pre-Roll (ms)
              </label>
              <input
                type="number"
                min="0"
                max="500"
                value={form.preRollMs}
                onChange={(e) => setForm({ ...form, preRollMs: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Breathing room before first syllable (default: 40ms)
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-200 block mb-1">
                Post-Roll (ms)
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={form.postRollMs}
                onChange={(e) => setForm({ ...form, postRollMs: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Consonant / reverb tail extension (default: 80ms)
              </span>
            </div>
          </div>

          {/* Min Instrumental Gap */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1">
              Minimum Instrumental Gap (ms)
            </label>
            <input
              type="number"
              min="50"
              max="2000"
              value={form.minInstrumentalMs}
              onChange={(e) => setForm({ ...form, minInstrumentalMs: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Gaps shorter than this are absorbed into neighboring lyric clips (default: 250ms)
            </span>
          </div>

          {/* Absorb Policy */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1">
              Short Gap Absorption Policy
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "previous", label: "Previous Line (Default)" },
                { key: "next", label: "Next Line" },
                { key: "split", label: "Split Evenly" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setForm({ ...form, absorbPolicy: item.key as ProjectSettings["absorbPolicy"] })}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    form.absorbPolicy === item.key
                      ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-semibold"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Boundary Search Window */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1">
              Boundary Snap Search Window (±ms)
            </label>
            <input
              type="number"
              min="10"
              max="250"
              value={form.boundarySearchMs}
              onChange={(e) => setForm({ ...form, boundarySearchMs: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              RMS minimum and zero-crossing search radius around candidate cuts (default: ±80ms)
            </span>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.normalizeClips}
                onChange={(e) => setForm({ ...form, normalizeClips: e.target.checked })}
                className="accent-emerald-500 rounded"
              />
              <span className="text-slate-300 font-medium">Peak-normalize exported clips independently</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.spokenAsInstrumental}
                onChange={(e) => setForm({ ...form, spokenAsInstrumental: e.target.checked })}
                className="accent-emerald-500 rounded"
              />
              <span className="text-slate-300 font-medium">Treat spoken intro as instrumental</span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save & Apply Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
