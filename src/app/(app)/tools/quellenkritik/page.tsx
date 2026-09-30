"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAccess } from "@/components/access-provider";
import { ApplyButton } from "@/components/apply-button";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { newId, useWork } from "@/components/work-provider";
import { PDF_MAX_BYTES, PDF_MAX_PAGES, PDF_MIN_BUDGET_CENTS, TOOLS } from "@/config/tools";
import { WORK_LIMITS } from "@/config/work";
import { parseEmpfohleneQuellen, tabellenText } from "@/lib/answer-parse";
import type { Quelle } from "@/lib/work";

const max = Object.fromEntries(TOOLS.quellenkritik.fields.map((f) => [f.key, f.maxChars]));
const maxSuche = Object.fromEntries(TOOLS.quellensuche.fields.map((f) => [f.key, f.maxChars]));
const SUCHE_MIN_CENTS = TOOLS.quellensuche.minBudgetCents;
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function QuellenkritikPage() {
  const { loaded } = useWork();
  if (!loaded) return <main className="text-zinc-600">Lade deine Seminararbeit …</main>;
  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Quellenkritik</h1>
      <Kritik />
      <hr className="my-8 border-zinc-200" />
      <Suche />
    </main>
  );
}

function Kritik() {
  const { restCents } = useAccess();
  const [modus] = useMode();
  const { work, update } = useWork();
  const { phase, answer, error, busy, run } = useToolStream();
  const [art, setArt] = useState<"pdf" | "text">("pdf");
  const [verwendung, setVerwendung] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [quelleId, setQuelleId] = useState("");
  const [titel, setTitel] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const quellen = work.quellen.filter((q) => q.status !== "verworfen");

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileError("");
    setFile(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setFileError("Bitte wähle eine PDF-Datei.");
    if (f.size > PDF_MAX_BYTES) return setFileError(`Die Datei ist zu groß (maximal ${PDF_MAX_BYTES / 1024 / 1024} MB).`);
    setFile(f);
  }

  function waehleQuelle(id: string) {
    setQuelleId(id);
    setTitel(work.quellen.find((q) => q.id === id)?.titel ?? "");
  }

  const pdfBudgetLow = art === "pdf" && restCents !== null && restCents < PDF_MIN_BUDGET_CENTS;
  const canSubmit = !busy && !pdfBudgetLow && (art === "pdf" ? !!file : text.trim() !== "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    if (art === "pdf" && file) {
      const form = new FormData();
      form.set("tool", "quellenkritik");
      form.set("fields", JSON.stringify({ verwendung }));
      form.set("file", file);
      await run({ form });
    } else {
      await run({ json: { tool: "quellenkritik", fields: { verwendung, text } } });
    }
  }

  // Die Tabelle "Einschätzung" wird als lesbare Bewertung an der Quelle gespeichert.
  function bewertungSpeichern() {
    const bewertung = tabellenText(answer, "Einschätzung").slice(0, WORK_LIMITS.quelleBewertung);
    update((w) => {
      if (quelleId && w.quellen.some((q) => q.id === quelleId)) {
        return { ...w, quellen: w.quellen.map((q) => (q.id === quelleId ? { ...q, bewertung, status: "geprueft" as const, titel: titel.trim() || q.titel } : q)) };
      }
      const neu: Quelle = { id: newId(), titel: titel.trim().slice(0, WORK_LIMITS.quelleTitel), url: "", notiz: "", bewertung, status: "geprueft" };
      return { ...w, quellen: [...w.quellen, neu].slice(0, WORK_LIMITS.maxQuellen) };
    });
  }

  const tab = (active: boolean) =>
    `min-h-12 flex-1 rounded border px-3 text-base ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`;

  return (
    <section aria-label="Quelle prüfen">
      <p className="mb-4 text-zinc-600">
        Du bekommst eine kritische Einschätzung zu Autor, Interessen, Methodik, Aktualität, Schwächen und Eignung für deine Fragestellung.
        {modus === "schreiben" && " Dazu bekommst du einen Formulierungsvorschlag für einen Absatz zur Quellenkritik."}
      </p>
      <ModeNote />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Bitte lade nichts mit persönlichen Daten hoch (zum Beispiel deinen Namen oder deine Schule). Das PDF wird nicht gespeichert.
        </p>

        {quellen.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Welche Quelle aus deiner Liste prüfst du?</span>
            <select className={`${input} min-h-12`} value={quelleId} onChange={(e) => waehleQuelle(e.target.value)}>
              <option value="">Eine neue Quelle</option>
              {quellen.map((q) => <option key={q.id} value={q.id}>{q.titel || "Ohne Titel"}</option>)}
            </select>
          </label>
        )}

        <div className="flex gap-2" role="group" aria-label="Art der Quelle">
          <button type="button" className={tab(art === "pdf")} aria-pressed={art === "pdf"} onClick={() => setArt("pdf")}>PDF hochladen</button>
          <button type="button" className={tab(art === "text")} aria-pressed={art === "text"} onClick={() => setArt("text")}>Text einfügen</button>
        </div>

        {art === "pdf" ? (
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
        {work.fragestellung && <p className="text-xs text-zinc-500">Die KI kennt auch deine Fragestellung aus der Seminararbeit und beurteilt die Eignung dafür.</p>}

        <button disabled={!canSubmit} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI liest mit …" : "Quelle prüfen"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        <ResultView
          phase={phase}
          answer={answer}
          error={error}
          waitingText={art === "pdf" ? "Die KI liest dein PDF. Das kann etwas länger dauern …" : "Die KI liest deine Quelle …"}
          doneNote="Die KI kann sich irren. Prüfe die Angaben selbst nach, besonders zu Autor und Herkunft."
        />
        {phase === "done" && tabellenText(answer, "Einschätzung") && (
          <section className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="In Quellenliste speichern">
            <h2 className="font-semibold">Bewertung in deiner Quellenliste speichern</h2>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Titel der Quelle</span>
              <input className={input} value={titel} maxLength={WORK_LIMITS.quelleTitel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Autor, Titel, Jahr" />
            </label>
            <ApplyButton label={quelleId ? "Bewertung an dieser Quelle speichern" : "Als neue Quelle speichern"} disabled={!quelleId && !titel.trim()} onApply={bewertungSpeichern} />
          </section>
        )}
      </div>
    </section>
  );
}

function Suche() {
  const { restCents } = useAccess();
  const { work, update } = useWork();
  const { phase, answer, error, treffer, busy, run } = useToolStream();
  const [suchauftrag, setSuchauftrag] = useState(work.fragestellung ? `Belege für meine Fragestellung: ${work.fragestellung}`.slice(0, maxSuche.suchauftrag) : "");
  const [schwache, setSchwache] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const zuWenig = restCents !== null && restCents < SUCHE_MIN_CENTS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await run({ json: { tool: "quellensuche", fields: { suchauftrag, schwacheQuelle: schwache } } });
  }

  const empfohlen = phase === "done" ? parseEmpfohleneQuellen(answer, treffer) : [];
  const empfohleneUrls = new Set(empfohlen.map((q) => q.url));
  const weitere = phase === "done" ? treffer.filter((t) => !empfohleneUrls.has(t.url)) : [];

  const hinzufuegen = (q: Omit<Quelle, "id" | "status" | "bewertung">) =>
    update((w) => ({
      ...w,
      quellen: [...w.quellen, { id: newId(), bewertung: "", status: "neu" as const, ...q }].slice(0, WORK_LIMITS.maxQuellen),
    }));

  return (
    <section aria-label="Bessere Quellen suchen">
      <h2 className="mb-1 text-xl font-semibold">Bessere Quellen suchen</h2>
      <p className="mb-4 text-zinc-600">
        Die KI durchsucht das Internet nach verlässlichen Quellen (höchstens zwei Suchen). Du bekommst echte Fundstellen mit Link, die du selbst öffnen und prüfen musst. Das kostet mehr Budget: etwa 8 bis 12 Cent, du brauchst mindestens {SUCHE_MIN_CENTS} Cent Restbudget.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Wofür brauchst du bessere Quellen?</span>
          <textarea className={`${input} min-h-20`} value={suchauftrag} maxLength={maxSuche.suchauftrag} onChange={(e) => setSuchauftrag(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Bisherige Quelle und ihre Schwäche <span className="font-normal text-zinc-500">(optional)</span></span>
          <textarea className={`${input} min-h-20`} value={schwache} maxLength={maxSuche.schwacheQuelle} onChange={(e) => setSchwache(e.target.value)} placeholder="z. B. Schulbuchkapitel, das nur allgemein berichtet" />
        </label>
        {zuWenig && <p role="alert" className="text-red-700">Dein Restbudget reicht für eine Quellensuche nicht mehr aus.</p>}
        <button disabled={busy || zuWenig || !suchauftrag.trim()} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI sucht …" : "Quellen suchen"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        <ResultView
          phase={phase}
          answer={answer}
          error={error}
          waitingText="Die KI durchsucht das Internet. Das dauert etwa eine halbe Minute …"
          doneNote="Öffne jede Quelle selbst und prüfe sie, bevor du sie verwendest."
        />
        {empfohlen.length > 0 && (
          <section className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="Quellen übernehmen">
            <h3 className="font-semibold">Empfohlene Quellen in die Liste übernehmen</h3>
            {empfohlen.map((q, i) => (
              <div key={`${i}-${q.url}`} className="rounded border border-blue-100 bg-white p-3">
                <p className="font-medium">{q.titel}</p>
                <p className="text-sm text-zinc-600">{q.autor}</p>
                {q.echt ? (
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline">{q.url}</a>
                ) : (
                  <p className="text-sm text-red-700">Dieser Link kam nicht in den Suchergebnissen vor. Er wird nicht übernommen. Suche die Quelle selbst.</p>
                )}
                <div className="mt-2">
                  <ApplyButton
                    label="In Quellenliste übernehmen"
                    onApply={() =>
                      hinzufuegen({
                        titel: q.titel.slice(0, WORK_LIMITS.quelleTitel),
                        url: q.echt ? q.url.slice(0, WORK_LIMITS.quelleUrl) : "",
                        notiz: `${q.autor} – ${q.begruendung}`.slice(0, WORK_LIMITS.quelleNotiz),
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </section>
        )}
        {weitere.length > 0 && (
          <details className="mt-4 rounded border border-zinc-200 bg-white p-3">
            <summary className="cursor-pointer font-medium">Weitere Treffer der Suche ({weitere.length})</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {weitere.map((t) => (
                <li key={t.url} className="text-sm">
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="break-all underline">{t.titel || t.url}</a>
                  <div className="mt-1">
                    <ApplyButton label="In Quellenliste übernehmen" onApply={() => hinzufuegen({ titel: (t.titel || t.url).slice(0, WORK_LIMITS.quelleTitel), url: t.url.slice(0, WORK_LIMITS.quelleUrl), notiz: "Treffer der Quellensuche, noch nicht geprüft" })} />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
