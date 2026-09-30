"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ApplyButton } from "@/components/apply-button";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { useStoredForm } from "@/components/use-stored";
import { useWork } from "@/components/work-provider";
import { TOOLS } from "@/config/tools";
import { parseFragestellungVorschlaege } from "@/lib/answer-parse";

const max = Object.fromEntries(TOOLS.fragestellung.fields.map((f) => [f.key, f.maxChars]));
const input = "min-h-12 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function FragestellungPage() {
  const { work, loaded } = useWork();
  if (!loaded) return <main className="text-zinc-600">Lade deine Seminararbeit …</main>;
  // Das Formular startet mit den gespeicherten Angaben aus deiner Seminararbeit.
  return <Form initial={{ fach: work.fach, thema: work.thema, fragestellung: work.fragestellung, zeitraum: work.zeitraum }} />;
}

function Form({ initial }: { initial: { fach: string; thema: string; fragestellung: string; zeitraum: string } }) {
  const [mode] = useMode();
  const { update } = useWork();
  const { phase, answer, error, busy, run } = useToolStream("fragestellung");
  const [fields, setFields] = useStoredForm("fragestellung:fields", initial);
  const [gespeichert, setGespeichert] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setGespeichert(false);
    setFields((f) => ({ ...f, [key]: e.target.value }));
  };

  const speichern = (f = fields) => {
    update((w) => ({ ...w, fach: f.fach.trim(), thema: f.thema.trim(), fragestellung: f.fragestellung.trim(), zeitraum: f.zeitraum.trim() }));
    setGespeichert(true);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await run({ json: { tool: "fragestellung", fields } });
  }

  const vorschlaege = phase === "done" && mode === "schreiben" ? parseFragestellungVorschlaege(answer) : [];

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
        <button type="button" onClick={() => speichern()} className="min-h-10 rounded border border-zinc-400 px-3 text-sm">
          {gespeichert ? "✓ In Seminararbeit gespeichert" : "Angaben in meiner Seminararbeit speichern"}
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
        {vorschlaege.length > 0 && (
          <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="Vorschlag übernehmen">
            <h2 className="mb-2 font-semibold">Vorschlag als deine Fragestellung übernehmen</h2>
            <div className="flex flex-col gap-2">
              {vorschlaege.map((v, i) => (
                <ApplyButton
                  key={`${i}-${v}`}
                  label={`Übernehmen: ${v}`}
                  onApply={() => {
                    const f = { ...fields, fragestellung: v.slice(0, max.fragestellung) };
                    setFields(f);
                    speichern(f);
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-600">Die Fragestellung im Formular und in deiner Seminararbeit wird ersetzt. Prüfe die Formulierung und passe sie an.</p>
          </section>
        )}
      </div>
    </main>
  );
}
