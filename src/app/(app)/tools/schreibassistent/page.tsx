"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ApplyButton } from "@/components/apply-button";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { newId, useWork } from "@/components/work-provider";
import { TOOLS } from "@/config/tools";
import { WORK_LIMITS } from "@/config/work";
import { parseEntwurf } from "@/lib/answer-parse";

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
  const { loaded } = useWork();

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
      ) : !loaded ? (
        <p className="text-zinc-600">Lade deine Seminararbeit …</p>
      ) : (
        <Form />
      )}
    </main>
  );
}

function Form() {
  const { work, update } = useWork();
  const { phase, answer, error, busy, run } = useToolStream();
  const [f, setF] = useState({ aufgabe: "Einleitung", laenge: "mittel", fragestellung: work.fragestellung, inhalt: "", text: "", kapitelId: "" });
  const [punktId, setPunktId] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const kapitel = work.kapitel.find((k) => k.id === f.kapitelId);
  const offene = work.punkte.filter((p) => !p.erledigt);
  const ueberarbeiten = f.aufgabe === "Überarbeiten";
  const gespeicherterText = ueberarbeiten && kapitel && kapitel.text.trim() && !f.text.trim() ? kapitel.text : "";
  const zuLang = gespeicherterText.length > max.text;
  const hatInhalt = f.inhalt.trim() !== "" || f.text.trim() !== "" || (!!gespeicherterText && !zuLang);

  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [key]: e.target.value }));

  function waehlePunkt(id: string) {
    setPunktId(id);
    const p = work.punkte.find((x) => x.id === id);
    if (p) setF((v) => ({ ...v, inhalt: p.text, aufgabe: kapitel?.text.trim() ? "Überarbeiten" : v.aufgabe }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await run({ json: { tool: "schreibassistent", fields: f } });
  }

  const entwurf = phase === "done" ? parseEntwurf(answer) || answer : "";
  const cut = (s: string) => s.slice(0, WORK_LIMITS.kapitelText);

  return (
    <>
      <p className="mb-4 text-zinc-600">
        Du gibst Stichpunkte oder einen Text, die KI formuliert daraus einen Entwurf. Fakten, die du nicht angibst, erfindet sie nicht.
      </p>
      <ModeNote>Der Entwurf ist nur so gut wie deine Stichpunkte. </ModeNote>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Bitte schreibe keine Namen (auch nicht deinen) und keinen Schulnamen in die Felder.
        </p>

        {work.kapitel.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Für welches Kapitel?</span>
            <select className={`${input} min-h-12`} value={f.kapitelId} onChange={set("kapitelId")}>
              <option value="">Kein bestimmtes Kapitel</option>
              {work.kapitel.map((k) => <option key={k.id} value={k.id}>{k.titel || "Ohne Titel"}{k.text.trim() ? "" : " (leer)"}</option>)}
            </select>
          </label>
        )}

        {offene.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Einen offenen Punkt angehen <span className="font-normal text-zinc-500">(optional)</span></span>
            <select className={`${input} min-h-12`} value={punktId} onChange={(e) => waehlePunkt(e.target.value)}>
              <option value="">Keinen</option>
              {offene.map((p) => <option key={p.id} value={p.id}>{p.text.slice(0, 80)}</option>)}
            </select>
          </label>
        )}

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
        {gespeicherterText && !zuLang && <p className="rounded bg-blue-50 p-3 text-sm text-blue-950">Der gespeicherte Text des Kapitels „{kapitel?.titel || "Ohne Titel"}“ wird überarbeitet.</p>}
        {zuLang && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">Das Kapitel ist für eine Überarbeitung auf einmal zu lang (maximal {max.text} Zeichen). Füge unten den Abschnitt ein, den du überarbeiten willst.</p>}
        <label className="flex flex-col gap-1">
          <span className="font-medium">
            {ueberarbeiten ? "Text, der überarbeitet werden soll" : "Vorhandener Text"}{" "}
            <span className="font-normal text-zinc-500">{ueberarbeiten ? (gespeicherterText && !zuLang ? "(optional, sonst der Kapiteltext)" : "(Pflicht)") : "(optional, als Grundlage)"}</span>
          </span>
          <textarea className={`${input} min-h-36`} value={f.text} onChange={set("text")} maxLength={max.text} required={ueberarbeiten && !(gespeicherterText && !zuLang)} />
          <span className="text-xs text-zinc-500">{f.text.length} / {max.text} Zeichen</span>
        </label>
        <button disabled={busy || !hatInhalt} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI schreibt …" : "Entwurf schreiben"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        <ResultView phase={phase} answer={answer} error={error} waitingText="Die KI schreibt deinen Entwurf. Das dauert einen Moment …" />
        {phase === "done" && entwurf && (
          <section className="mt-4 flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="Entwurf übernehmen">
            <h2 className="font-semibold">Entwurf in deine Seminararbeit übernehmen</h2>
            {kapitel && (
              <>
                <ApplyButton label={`Kapitel „${kapitel.titel || "Ohne Titel"}“ durch den Entwurf ersetzen`} onApply={() => update((w) => ({ ...w, kapitel: w.kapitel.map((k) => (k.id === kapitel.id ? { ...k, text: cut(entwurf) } : k)) }))} />
                <ApplyButton label={`An Kapitel „${kapitel.titel || "Ohne Titel"}“ anhängen`} onApply={() => update((w) => ({ ...w, kapitel: w.kapitel.map((k) => (k.id === kapitel.id ? { ...k, text: cut(`${k.text.trimEnd()}\n\n${entwurf}`.trim()) } : k)) }))} />
              </>
            )}
            <ApplyButton
              label="Als neues Kapitel speichern"
              disabled={work.kapitel.length >= WORK_LIMITS.maxKapitel}
              onApply={() => update((w) => ({ ...w, kapitel: [...w.kapitel, { id: newId(), titel: f.aufgabe === "Überarbeiten" ? "Überarbeiteter Text" : f.aufgabe, text: cut(entwurf) }] }))}
            />
            {punktId && offene.some((p) => p.id === punktId) && (
              <ApplyButton label="Den offenen Punkt als erledigt markieren" onApply={() => update((w) => ({ ...w, punkte: w.punkte.map((p) => (p.id === punktId ? { ...p, erledigt: true } : p)) }))} />
            )}
            <p className="text-xs text-zinc-600">Prüfe den Text, setze für jede Stelle „[Beleg nötig]“ eine echte Quelle ein und kennzeichne die KI-Hilfe in deiner Arbeit.</p>
          </section>
        )}
      </div>
    </>
  );
}
