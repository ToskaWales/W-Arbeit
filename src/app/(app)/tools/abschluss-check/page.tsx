"use client";

import Link from "next/link";
import { useRef } from "react";
import { useAccess } from "@/components/access-provider";
import { ChatPanel } from "@/components/chat-panel";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { useStoredValue } from "@/components/use-stored";
import { useToolChat } from "@/components/use-tool-chat";
import { newId, useWork } from "@/components/work-provider";
import { ABSCHLUSS_KAPITEL_MIN_BUDGET_CENTS, ABSCHLUSS_KAPITEL_MIN_CHARS, TOOLS } from "@/config/tools";
import { bulletItems, parseNachbesserungen } from "@/lib/answer-parse";
import { ersetzeOffenePunkte } from "@/lib/punkte";

const MIN_CENTS = TOOLS.abschluss.minBudgetCents;
const FOKUS = TOOLS.abschluss.fields[0].options!;
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";

export default function AbschlussPage() {
  const { work, loaded, update } = useWork();
  const { restCents } = useAccess();
  const [mode] = useMode();
  const chat = useToolChat("abschluss");
  const { busy } = chat;
  const [fokus, setFokus] = useStoredValue("abschluss:fokus", "alles");
  const [kapitelId, setKapitelId] = useStoredValue("abschluss:kapitel", ""); // leer = ganze Arbeit
  const resultRef = useRef<HTMLDivElement>(null);

  if (!loaded) return <main className="text-zinc-600">Lade deine Seminararbeit …</main>;

  const geschrieben = work.kapitel.filter((k) => k.text.trim().length >= ABSCHLUSS_KAPITEL_MIN_CHARS);
  const kapitel = geschrieben.find((k) => k.id === kapitelId); // gelöschte Kapitel fallen auf "ganze Arbeit" zurück
  const einzeln = !!kapitel;
  const zeichen = work.kapitel.reduce((n, k) => n + k.text.trim().length, 0);
  const bereit = einzeln || zeichen >= 200;
  const minCents = einzeln ? ABSCHLUSS_KAPITEL_MIN_BUDGET_CENTS : MIN_CENTS;
  const zuWenig = restCents !== null && restCents < minCents;
  const aktiv = chat.turns.length > 0 || busy;
  const ersteListe = chat.turns.length > 0 ? parseNachbesserungen(chat.turns[0].content).map((t) => `- ${t}`).join("\n") : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const payload = { tool: "abschluss", fields: { fokus, kapitelId: kapitel?.id ?? "" } };
    const text = await chat.start({ json: payload }, payload);
    // Nur die Prüfung der ganzen Arbeit zählt für den Fahrplan
    if (text && !kapitel) update((w) => ({ ...w, meilensteine: { ...w.meilensteine, abschlussCheck: Date.now() } }));
  }

  function alsPunkteUebernehmen(liste: string) {
    const nachbesserungen = bulletItems(liste);
    // Bei einem einzelnen Kapitel nur ergänzen, damit die offenen Punkte zu anderen Kapiteln bleiben.
    const texte = kapitel ? nachbesserungen.map((t) => (t.startsWith("[") ? t : `[${kapitel.titel || "Kapitel"}] ${t}`)) : nachbesserungen;
    update((w) => ({ ...w, punkte: ersetzeOffenePunkte(w.punkte, "abschluss", texte, newId, !!kapitel) }));
  }

  return (
    <main>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Abschluss-Check</h1>
      <p className="mb-4 text-zinc-600">
        Die KI prüft Fragestellung, roten Faden, Belege, Vollständigkeit sowie Sprache und Form und nennt die wichtigsten Nachbesserungen. Danach klärt ihr im Chat, welche davon wirklich zu tun sind.
        {mode === "schreiben" && " Zu den zwei wichtigsten Punkten bekommst du außerdem Verbesserungsvorschläge."}
      </p>
      <ModeNote />

      {aktiv ? null : !bereit ? (
        <div className="rounded-lg border border-zinc-300 bg-white p-4">
          <p className="mb-3">Für den Abschluss-Check brauche ich geschriebene Kapitel in deiner Seminararbeit (mindestens etwa 200 Zeichen). Bisher: {zeichen} Zeichen.</p>
          <Link href="/arbeit" className="flex min-h-12 items-center justify-center rounded bg-zinc-900 px-4 text-white">Zu meiner Seminararbeit</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Was soll geprüft werden?</span>
            <select className={`${input} min-h-12`} value={kapitel?.id ?? ""} onChange={(e) => setKapitelId(e.target.value)}>
              <option value="">Die ganze Arbeit</option>
              {geschrieben.map((k) => <option key={k.id} value={k.id}>Nur: {k.titel || "Ohne Titel"}</option>)}
            </select>
          </label>
          <p className="rounded bg-blue-50 p-3 text-sm text-blue-950">
            {einzeln
              ? `Die KI liest nur dieses Kapitel (${kapitel!.text.trim().length.toLocaleString("de-DE")} Zeichen) mit deiner Fragestellung und Gliederung. Das ist deutlich günstiger, ideal zum Nachbessern (etwa 1 bis 2 Cent, mindestens ${minCents} Cent Restbudget).`
              : `Die KI liest ${work.kapitel.filter((k) => k.text.trim()).length} Kapitel (${zeichen.toLocaleString("de-DE")} Zeichen), Gliederung und Quellenliste. Das kostet mehr Budget als die anderen Tools (etwa 5 bis 10 Cent, mindestens ${minCents} Cent Restbudget). Nach einer Änderung reicht oft die Prüfung des einen Kapitels.`}
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Schwerpunkt</span>
            <select className={`${input} min-h-12`} value={fokus} onChange={(e) => setFokus(e.target.value)}>
              {FOKUS.map((f) => <option key={f} value={f}>{f === "alles" ? "Alles prüfen" : f}</option>)}
            </select>
          </label>
          {zuWenig && <p role="alert" className="text-red-700">Dein Restbudget reicht für diese Prüfung nicht mehr aus.</p>}
          <button disabled={busy || zuWenig} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
            {busy ? "Die KI liest mit …" : einzeln ? "Kapitel prüfen" : "Arbeit prüfen"}
          </button>
        </form>
      )}

      <div ref={resultRef} className="scroll-mt-4">
        {chat.error && !aktiv && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{chat.error}</p>}
        {aktiv && (
          <ChatPanel
            chat={chat}
            titel="Nachbesserungen (werden zu offenen Punkten)"
            firstResult={ersteListe}
            rows={10}
            confirmLabel="Bestätigen und weiter zum Nachbessern"
            nextHref="/arbeit#punkte"
            onConfirm={alsPunkteUebernehmen}
            waitingText="Die KI liest deine Arbeit. Das kann eine halbe Minute dauern …"
            hint="Die KI kann sich irren. Entscheide selbst, welche Punkte du übernimmst: Streiche hier Zeilen, die du nicht willst. Noch offene Punkte aus dem letzten Abschluss-Check werden ersetzt, erledigte bleiben."
            placeholder="Frag nach, widersprich einem Punkt oder bitte um Änderungen an der Liste …"
          />
        )}
      </div>
    </main>
  );
}
