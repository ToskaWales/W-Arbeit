"use client";

import { FormattedText } from "./formatted-text";
import { useMode } from "./mode-store";
import type { Phase } from "./use-tool-stream";

export function Spinner({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-zinc-600">
      <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" aria-hidden />
      {children}
    </p>
  );
}

export function ResultView({
  phase,
  answer,
  error,
  waitingText,
  doneNote,
}: {
  phase: Phase;
  answer: string;
  error: string;
  waitingText: string;
  doneNote?: string;
}) {
  const [mode] = useMode();
  const note =
    mode === "schreiben"
      ? "Die KI kann sich irren. Prüfe alle Fakten, ersetze „[Beleg nötig]“ durch echte Quellen und gib die KI-Hilfe in deiner Arbeit an."
      : doneNote;
  return (
    <div className="mt-6 scroll-mt-4" aria-busy={phase === "waiting" || phase === "streaming"}>
      {phase === "waiting" && <Spinner>{waitingText}</Spinner>}
      {answer && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <FormattedText text={answer} />
          {phase === "streaming" && <span className="mt-2 inline-block animate-pulse text-zinc-400">▍</span>}
        </section>
      )}
      {phase === "done" && note && <p className="mt-3 text-sm text-zinc-500">{note}</p>}
      {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    </div>
  );
}
