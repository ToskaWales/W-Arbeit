"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { useToolChat } from "@/components/use-tool-chat";
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
  const chat = useToolChat("fragestellung");
  const { busy } = chat;
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
    await chat.start({ json: { tool: "fragestellung", fields } }, { tool: "fragestellung", fields });
  }

  const aktiv = chat.turns.length > 0 || busy;
  const vorschlaege = mode === "schreiben" && chat.turns.length > 0 ? parseFragestellungVorschlaege(chat.turns[0].content) : [];

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Fragestellungs-Check</h1>
      <p className="mb-4 text-zinc-600">
        {mode === "schreiben"
          ? "Du bekommst Stärken, fünf mögliche Schwachstellen und drei ausformulierte Vorschläge für eine bessere Fragestellung."
          : "Du bekommst Stärken, fünf mögliche Schwachstellen und drei Rückfragen. Eine fertige Fragestellung bekommst du nicht."}{" "}
        Danach arbeitet ihr im Chat weiter, bis deine Fragestellung steht. Du entscheidest, wann sie gut genug ist.
      </p>
      <ModeNote />

      {!aktiv && (
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
      )}

      <div ref={resultRef} className="scroll-mt-4">
        {chat.error && !aktiv && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{chat.error}</p>}
        {aktiv && (
          <ChatPanel
            chat={chat}
            titel="Deine Fragestellung"
            firstResult={fields.fragestellung}
            suggestions={vorschlaege}
            rows={3}
            confirmLabel="Bestätigen und weiter zu den Quellen"
            nextHref="/tools/quellenkritik"
            onConfirm={(text) => {
              const f = { ...fields, fragestellung: text.slice(0, max.fragestellung) };
              setFields(f);
              speichern(f);
            }}
            waitingText="Die KI liest deine Fragestellung. Das dauert ein paar Sekunden …"
            hint="Denke selbst über die Rückfragen nach und schärfe deine Fragestellung in eigenen Worten."
            placeholder="Antworte auf die Rückfragen oder schreib deine verbesserte Fragestellung …"
          />
        )}
      </div>
    </main>
  );
}
