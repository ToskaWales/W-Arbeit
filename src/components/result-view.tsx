import { FormattedText } from "./formatted-text";
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
  return (
    <div className="mt-6 scroll-mt-4" aria-busy={phase === "waiting" || phase === "streaming"}>
      {phase === "waiting" && <Spinner>{waitingText}</Spinner>}
      {answer && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <FormattedText text={answer} />
          {phase === "streaming" && <span className="mt-2 inline-block animate-pulse text-zinc-400">▍</span>}
        </section>
      )}
      {phase === "done" && doneNote && <p className="mt-3 text-sm text-zinc-500">{doneNote}</p>}
      {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    </div>
  );
}
