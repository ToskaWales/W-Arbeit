"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAccess } from "@/components/access-provider";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { PDF_MAX_BYTES, PDF_MAX_PAGES, PDF_MIN_BUDGET_CENTS, TOOLS } from "@/config/tools";

const max = Object.fromEntries(TOOLS.quellenkritik.fields.map((f) => [f.key, f.maxChars]));
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function QuellenkritikPage() {
  const { restCents } = useAccess();
  const [modus] = useMode();
  const { phase, answer, error, busy, run } = useToolStream();
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [verwendung, setVerwendung] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileError("");
    setFile(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setFileError("Bitte wähle eine PDF-Datei.");
    if (f.size > PDF_MAX_BYTES) return setFileError(`Die Datei ist zu groß (maximal ${PDF_MAX_BYTES / 1024 / 1024} MB).`);
    setFile(f);
  }

  const pdfBudgetLow = mode === "pdf" && restCents !== null && restCents < PDF_MIN_BUDGET_CENTS;
  const canSubmit = !busy && !pdfBudgetLow && (mode === "pdf" ? !!file : text.trim() !== "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    if (mode === "pdf" && file) {
      const form = new FormData();
      form.set("tool", "quellenkritik");
      form.set("fields", JSON.stringify({ verwendung }));
      form.set("file", file);
      await run({ form });
    } else {
      await run({ json: { tool: "quellenkritik", fields: { verwendung, text } } });
    }
  }

  const tab = (active: boolean) =>
    `min-h-12 flex-1 rounded border px-3 text-base ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`;

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Quellenkritik</h1>
      <p className="mb-4 text-zinc-600">
        Du bekommst eine kritische Einschätzung zu Autor, Interessen, Methodik, Aktualität, Schwächen und Eignung für dein Vorhaben.
        {modus === "schreiben" && " Dazu bekommst du einen Formulierungsvorschlag für einen Absatz zur Quellenkritik."}
      </p>
      <ModeNote />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Bitte lade nichts mit persönlichen Daten hoch (zum Beispiel deinen Namen oder deine Schule). Das PDF wird nicht gespeichert.
        </p>

        <div className="flex gap-2" role="group" aria-label="Art der Quelle">
          <button type="button" className={tab(mode === "pdf")} aria-pressed={mode === "pdf"} onClick={() => setMode("pdf")}>PDF hochladen</button>
          <button type="button" className={tab(mode === "text")} aria-pressed={mode === "text"} onClick={() => setMode("text")}>Text einfügen</button>
        </div>

        {mode === "pdf" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="pdf" className="font-medium">PDF-Datei</label>
            <input id="pdf" type="file" accept="application/pdf,.pdf" onChange={pickFile} className="text-base" />
            <p className="text-xs text-zinc-500">
              Bis {PDF_MAX_BYTES / 1024 / 1024} MB und {PDF_MAX_PAGES} Seiten. Lade am besten nur die relevanten Seiten hoch. Ein PDF verbraucht deutlich mehr Budget als eingefügter Text (du brauchst mindestens {PDF_MIN_BUDGET_CENTS} Cent Restbudget).
            </p>
            {fileError && <p role="alert" className="text-red-700">{fileError}</p>}
            {pdfBudgetLow && <p role="alert" className="text-red-700">Dein Restbudget reicht für ein PDF nicht mehr aus. Du kannst stattdessen Text einfügen.</p>}
          </div>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Quellentext</span>
            <textarea className={`${input} min-h-48`} value={text} onChange={(e) => setText(e.target.value)} maxLength={max.text} placeholder="Füge hier den Text der Quelle ein." />
            <span className="text-xs text-zinc-500">{text.length} / {max.text} Zeichen</span>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="font-medium">Wofür willst du die Quelle nutzen?</span>
          <textarea className={`${input} min-h-20`} value={verwendung} onChange={(e) => setVerwendung(e.target.value)} maxLength={max.verwendung} placeholder="z. B. als Beleg für meine These in Kapitel 3" required />
        </label>

        <button disabled={!canSubmit} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI liest mit …" : "Quelle prüfen"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        <ResultView
          phase={phase}
          answer={answer}
          error={error}
          waitingText={mode === "pdf" ? "Die KI liest dein PDF. Das kann etwas länger dauern …" : "Die KI liest deine Quelle …"}
          doneNote="Die KI kann sich irren. Prüfe die Angaben selbst nach, besonders zu Autor und Herkunft."
        />
      </div>
    </main>
  );
}
