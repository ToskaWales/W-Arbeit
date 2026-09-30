"use client";

import { useState } from "react";

// Knopf, der ein Ergebnis in die Seminararbeit übernimmt und danach kurz bestätigt.
export function ApplyButton({ label, onApply, disabled }: { label: string; onApply: () => void; disabled?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onApply();
        setDone(true);
      }}
      className={`min-h-10 rounded border px-3 text-left text-sm disabled:opacity-50 ${done ? "border-green-700 bg-green-50 text-green-900" : "border-zinc-500 bg-white"}`}
    >
      {done ? "✓ Übernommen" : label}
    </button>
  );
}
