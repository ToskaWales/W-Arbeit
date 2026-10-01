"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { useToolChat } from "@/components/use-tool-chat";
import { useStoredForm, useStoredValue } from "@/components/use-stored";
import { useWork } from "@/components/work-provider";
import { TOOLS } from "@/config/tools";
import { parseGliederungVorschlag, stripGliederungNotes } from "@/lib/answer-parse";

const max = Object.fromEntries(TOOLS["roter-faden"].fields.map((f) => [f.key, f.maxChars]));
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function RoterFadenPage() {
  const { work, loaded } = useWork();
  if (!loaded) return <main className="text-zinc-600">Lade deine Seminararbeit …</main>;
  return <Form initial={{ fragestellung: work.fragestellung, gliederung: work.gliederung }} />;
}

function Form({ initial }: { initial: { fragestellung: string; gliederung: string } }) {
  const [mode] = useMode();
  const { work, update } = useWork();
  const chat = useToolChat("roter-faden");
  const { busy } = chat;
  const [fields, setFields] = useStoredForm("roter-faden:fields", initial);
  const [mitTexten, setMitTexten] = useStoredValue("roter-faden:mit", false);
  const [gespeichert, setGespeichert] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const geschriebeneKapitel = work.kapitel.filter((k) => k.text.trim()).length;

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGespeichert(false);
    setFields((f) => ({ ...f, [key]: e.target.value }));
  };

  const speichern = (f = fields) => {
    update((w) => ({ ...w, fragestellung: f.fragestellung.trim(), gliederung: f.gliederung.trim() }));
    setGespeichert(true);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const payload = { tool: "roter-faden", fields: { ...fields, mitTexten: mitTexten && geschriebeneKapitel > 0 ? "ja" : "nein" } };
    await chat.start({ json: payload }, payload);
  }

  const aktiv = chat.turns.length > 0 || busy;
  // Im Schreibmodus ist der Vorschlag der KI der Ausgangspunkt, sonst die eigene Gliederung des Schülers.
  const ersterVorschlag = mode === "schreiben" && chat.turns.length > 0 ? stripGliederungNotes(parseGliederungVorschlag(chat.turns[0].content)) : "";
  const firstResult = ersterVorschlag || fields.gliederung;

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Rote-Faden-Check</h1>
      <p className="mb-4 text-zinc-600">
        {mode === "schreiben"
          ? "Du erfährst, wo dein Gedankengang springt, welche Kapitel nichts zur Fragestellung beitragen und was fehlt. Dazu bekommst du einen Vorschlag für eine überarbeitete Gliederung."
          : "Du erfährst, wo dein Gedankengang springt, welche Kapitel nichts zur Fragestellung beitragen und was fehlt. Eine neue Gliederung bekommst du nicht."}{" "}
        Danach arbeitet ihr im Chat weiter, bis die Gliederung steht.
      </p>
      <ModeNote />

      {!aktiv && (
        <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          Bitte schreibe keine Namen (auch nicht deinen) und keinen Schulnamen in die Felder.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Deine Fragestellung</span>
          <textarea className={`${input} min-h-24`} value={fields.fragestellung} onChange={set("fragestellung")} maxLength={max.fragestellung} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Deine Gliederung</span>
          <textarea
            className={`${input} min-h-56`}
            value={fields.gliederung}
            onChange={set("gliederung")}
            maxLength={max.gliederung}
            placeholder={"1 Einleitung\n2 ...\n2.1 ...\n3 ..."}
            required
          />
          <span className="text-xs text-zinc-500">Ein Punkt pro Zeile. {fields.gliederung.length} / {max.gliederung} Zeichen</span>
        </label>
        {geschriebeneKapitel > 0 && (
          <label className="flex min-h-12 items-center gap-3 rounded border border-zinc-300 px-3">
            <input type="checkbox" className="h-5 w-5" checked={mitTexten} onChange={(e) => setMitTexten(e.target.checked)} />
            <span>Auch die Anfänge meiner {geschriebeneKapitel} geschriebenen Kapitel prüfen</span>
          </label>
        )}
        <button disabled={busy} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI liest mit …" : "Gliederung prüfen"}
        </button>
        <button type="button" onClick={() => speichern()} className="min-h-10 rounded border border-zinc-400 px-3 text-sm">
          {gespeichert ? "✓ In Seminararbeit gespeichert" : "Fragestellung und Gliederung in meiner Seminararbeit speichern"}
        </button>
      </form>
      )}

      <div ref={resultRef} className="scroll-mt-4">
        {chat.error && !aktiv && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{chat.error}</p>}
        {aktiv && (
          <ChatPanel
            chat={chat}
            titel="Deine Gliederung"
            firstResult={firstResult}
            rows={10}
            confirmLabel="Bestätigen und weiter zu den Kapiteln"
            nextHref="/arbeit"
            onConfirm={(text) => {
              const f = { ...fields, gliederung: text.slice(0, max.gliederung) };
              setFields(f);
              speichern(f);
            }}
            waitingText="Die KI liest deine Gliederung. Das dauert ein paar Sekunden …"
            hint="Die KI kann sich irren. Entscheide selbst, was du an deiner Gliederung änderst. Danach legst du in „Meine Arbeit“ die Kapitel daraus an."
            placeholder="Beantworte die Fragen oder schick deine überarbeitete Gliederung …"
          />
        )}
      </div>
    </main>
  );
}
