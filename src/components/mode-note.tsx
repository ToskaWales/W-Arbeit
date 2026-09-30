"use client";

import { useMode } from "./mode-store";

// Kurzer Hinweis auf den Tool-Seiten, was der aktuelle Modus bedeutet.
export function ModeNote({ children }: { children?: React.ReactNode }) {
  const [mode] = useMode();
  if (mode !== "schreiben") return null;
  return (
    <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-950">
      <strong>Schreibmodus:</strong> {children ?? "Die KI formuliert auch aus. "}Übernommene KI-Texte musst du in deiner Arbeit kenntlich machen.
    </p>
  );
}
