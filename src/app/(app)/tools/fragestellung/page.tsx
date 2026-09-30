"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAccess } from "@/components/access-provider";
import { FormattedText } from "@/components/formatted-text";
import { TOOLS } from "@/config/tools";

type Phase = "idle" | "waiting" | "streaming" | "done" | "error";

const max = Object.fromEntries(TOOLS.fragestellung.fields.map((f) => [f.key, f.maxChars]));
const input = "min-h-12 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function FragestellungPage() {
  const { code, refreshBudget, logout } = useAccess();
  const [fields, setFields] = useState({ fach: "", thema: "", fragestellung: "", zeitraum: "" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));
  const busy = phase === "waiting" || phase === "streaming";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAnswer("");
    setPhase("waiting");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    let res: Response;
    try {
      res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tool: "fragestellung", fields }),
      });
    } catch {
      setError("Keine Verbindung. Prüfe dein Internet und versuche es noch einmal.");
      return setPhase("error");
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Etwas ist schiefgegangen. Bitte versuche es noch einmal.");
      if (res.status === 401 || res.status === 403) logout(); // Code ungültig oder gesperrt
      if (res.status === 402) void refreshBudget();
      return setPhase("error");
    }

    try {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setPhase("streaming");
        setAnswer((a) => a + decoder.decode(value, { stream: true }));
      }
      setPhase("done");
    } catch {
      setError("Die Verbindung wurde unterbrochen. Die Antwort oben ist unvollständig.");
      setPhase("error");
    }
    void refreshBudget();
  }

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Fragestellungs-Check</h1>
      <p className="mb-5 text-zinc-600">
        Du bekommst Stärken, fünf mögliche Schwachstellen und drei Rückfragen. Eine fertige Fragestellung bekommst du nicht.
      </p>

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

      <div ref={resultRef} className="mt-6 scroll-mt-4" aria-busy={busy}>
        {phase === "waiting" && (
          <p className="flex items-center gap-2 text-zinc-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" aria-hidden />
            Die KI liest deine Fragestellung. Das dauert ein paar Sekunden …
          </p>
        )}
        {answer && (
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <FormattedText text={answer} />
            {phase === "streaming" && <span className="mt-2 inline-block animate-pulse text-zinc-400">▍</span>}
          </section>
        )}
        {phase === "done" && (
          <p className="mt-3 text-sm text-zinc-500">
            Denke selbst über die Rückfragen nach und schärfe deine Fragestellung in eigenen Worten.
          </p>
        )}
        {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}
      </div>
    </main>
  );
}
