"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { TOOLS } from "@/config/tools";

const max = Object.fromEntries(TOOLS.fragestellung.fields.map((f) => [f.key, f.maxChars]));
const input = "min-h-12 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function FragestellungPage() {
  const [mode] = useMode();
  const { phase, answer, error, busy, run } = useToolStream();
  const [fields, setFields] = useState({ fach: "", thema: "", fragestellung: "", zeitraum: "" });
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await run({ json: { tool: "fragestellung", fields } });
  }

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Fragestellungs-Check</h1>
      <p className="mb-4 text-zinc-600">
        {mode === "schreiben"
          ? "Du bekommst Stärken, fünf mögliche Schwachstellen und drei ausformulierte Vorschläge für eine bessere Fragestellung."
          : "Du bekommst Stärken, fünf mögliche Schwachstellen und drei Rückfragen. Eine fertige Fragestellung bekommst du nicht."}
      </p>
      <ModeNote />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Bitte schreibe keine Namen (auch nicht deinen) und keinen Schulnamen in die Felder.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Fach</span>
          <input className={input} value={fields.fach} onChange={set("fach")} maxLength={max.fach} placeholder="z. B. Geschichte" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Thema</span>
          <input className={input} value={fields.thema} onChange={set("thema")} maxLength={max.thema} placeholder="z. B. Die Weimarer Republik" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Deine Fragestellung</span>
          <textarea className={`${input} min-h-28`} value={fields.fragestellung} onChange={set("fragestellung")} maxLength={max.fragestellung} required />
          <span className="text-xs text-zinc-500">{fields.fragestellung.length} / {max.fragestellung} Zeichen</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Verfügbarer Zeitraum</span>
          <input className={input} value={fields.zeitraum} onChange={set("zeitraum")} maxLength={max.zeitraum} placeholder="z. B. 5 Monate" required />
        </label>
        <button disabled={busy} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI liest mit …" : "Fragestellung prüfen"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        <ResultView
          phase={phase}
          answer={answer}
          error={error}
          waitingText="Die KI liest deine Fragestellung. Das dauert ein paar Sekunden …"
          doneNote="Denke selbst über die Rückfragen nach und schärfe deine Fragestellung in eigenen Worten."
        />
      </div>
    </main>
  );
}
