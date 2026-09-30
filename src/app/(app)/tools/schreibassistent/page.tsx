"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { TOOLS } from "@/config/tools";

const cfg = TOOLS.schreibassistent.fields;
const max = Object.fromEntries(cfg.map((f) => [f.key, f.maxChars]));
const AUFGABEN = cfg.find((f) => f.key === "aufgabe")!.options!;
const LAENGEN = [
  { value: "kurz", label: "Kurz", hint: "ca. 150 Wörter" },
  { value: "mittel", label: "Mittel", hint: "ca. 300 Wörter" },
  { value: "lang", label: "Lang", hint: "ca. 600 Wörter" },
];
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function SchreibassistentPage() {
  const [mode, setMode] = useMode();
  const { phase, answer, error, busy, run } = useToolStream();
  const [f, setF] = useState({ aufgabe: "Einleitung", laenge: "mittel", fragestellung: "", inhalt: "", text: "" });
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [key]: e.target.value }));
  const ueberarbeiten = f.aufgabe === "Überarbeiten";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await run({ json: { tool: "schreibassistent", fields: f } });
  }

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Schreibassistent</h1>

      {mode !== "schreiben" ? (
        <div className="mt-3 rounded-lg border border-zinc-300 bg-white p-4">
          <p className="mb-3">Den Schreibassistenten gibt es nur im Schreibmodus. Dort formuliert die KI Texte für dich aus.</p>
          <button onClick={() => setMode("schreiben")} className="min-h-12 w-full rounded bg-zinc-900 px-4 text-base text-white">
            Schreibmodus einschalten
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-zinc-600">
            Du gibst Stichpunkte, die KI formuliert daraus einen Entwurf. Fakten, die du nicht angibst, erfindet sie nicht.
          </p>
          <ModeNote>Der Entwurf ist nur so gut wie deine Stichpunkte. </ModeNote>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
              Bitte schreibe keine Namen (auch nicht deinen) und keinen Schulnamen in die Felder.
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Was soll die KI schreiben?</span>
              <select className={`${input} min-h-12`} value={f.aufgabe} onChange={set("aufgabe")}>
                {AUFGABEN.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <fieldset className="flex gap-2">
              <legend className="mb-1 font-medium">Länge</legend>
              {LAENGEN.map((l) => (
                <label key={l.value} className={`flex min-h-12 flex-1 flex-col items-center justify-center rounded border px-2 text-center text-sm ${f.laenge === l.value ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"}`}>
                  <input className="sr-only" type="radio" name="laenge" checked={f.laenge === l.value} onChange={() => setF((v) => ({ ...v, laenge: l.value }))} />
                  <strong>{l.label}</strong>
                  <span className="text-xs text-zinc-600">{l.hint}</span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Fragestellung deiner Arbeit <span className="font-normal text-zinc-500">(optional)</span></span>
              <textarea className={`${input} min-h-20`} value={f.fragestellung} onChange={set("fragestellung")} maxLength={max.fragestellung} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">{ueberarbeiten ? "Was soll besser werden?" : "Stichpunkte / Inhalt"}</span>
              <textarea
                className={`${input} min-h-36`}
                value={f.inhalt}
                onChange={set("inhalt")}
                maxLength={max.inhalt}
                placeholder={ueberarbeiten ? "z. B. klarer, kürzer, sachlicher" : "- Was willst du sagen?\n- Welche Punkte gehören dazu?\n- Welche Belege hast du schon?"}
              />
              <span className="text-xs text-zinc-500">{f.inhalt.length} / {max.inhalt} Zeichen</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">
                {ueberarbeiten ? "Dein vorhandener Text" : "Vorhandener Text"}{" "}
                <span className="font-normal text-zinc-500">{ueberarbeiten ? "(Pflicht)" : "(optional, als Grundlage)"}</span>
              </span>
              <textarea className={`${input} min-h-36`} value={f.text} onChange={set("text")} maxLength={max.text} required={ueberarbeiten} />
              <span className="text-xs text-zinc-500">{f.text.length} / {max.text} Zeichen</span>
            </label>
            <button
              disabled={busy || (f.inhalt.trim() === "" && f.text.trim() === "")}
              className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50"
            >
              {busy ? "Die KI schreibt …" : "Entwurf schreiben"}
            </button>
          </form>

          <div ref={resultRef} className="scroll-mt-4">
            <ResultView phase={phase} answer={answer} error={error} waitingText="Die KI schreibt deinen Entwurf. Das dauert einen Moment …" />
          </div>
        </>
      )}
    </main>
  );
}
