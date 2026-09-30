"use client";

import { MODE_LABELS, MODES } from "@/config/mode";
import { useMode } from "./mode-store";

export function ModeSwitch() {
  const [mode, setMode] = useMode();
  return (
    <div role="group" aria-label="Modus" className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`min-h-10 rounded-md px-3 font-medium ${mode === m ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
