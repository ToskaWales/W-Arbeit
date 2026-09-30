"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ResultView } from "@/components/result-view";
import { useToolStream } from "@/components/use-tool-stream";
import { TOOLS } from "@/config/tools";

const max = Object.fromEntries(TOOLS["roter-faden"].fields.map((f) => [f.key, f.maxChars]));
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function RoterFadenPage() {
  const { phase, answer, error, busy, run } = useToolStream();
  const [fields, setFields] = useState({ fragestellung: "", gliederung: "" });
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await run({ json: { tool: "roter-faden", fields } });
  }

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Rote-Faden-Check</h1>
      <p className="mb-5 text-zinc-600">
        Du erfährst, wo dein Gedankengang springt, welche Kapitel nichts zur Fragestellung beitragen und was fehlt. Eine neue Gliederung bekommst du nicht.
      </p>

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
        <button disabled={busy} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Die KI liest mit …" : "Gliederung prüfen"}
        </button>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        <ResultView
          phase={phase}
          answer={answer}
          error={error}
          waitingText="Die KI liest deine Gliederung. Das dauert ein paar Sekunden …"
          doneNote="Die KI kann sich irren. Entscheide selbst, was du an deiner Gliederung änderst."
        />
      </div>
    </main>
  );
}
