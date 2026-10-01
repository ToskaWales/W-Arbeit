"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHAT } from "@/config/tools";
import { lastErgebnis, splitErgebnis } from "@/lib/chat";
import { FormattedText } from "./formatted-text";
import { useMode } from "./mode-store";
import { Spinner } from "./result-view";
import type { ToolChat } from "./use-tool-chat";
import { useWork } from "./work-provider";

interface Props {
  chat: ToolChat;
  titel: string; // Überschrift der Ergebnis-Karte, z. B. "Deine Fragestellung"
  firstResult: string; // Ergebnis, solange die KI noch keins vorgeschlagen hat (zum Beispiel die eigene Eingabe des Schülers)
  suggestions?: string[]; // Vorschläge der KI, die per Klick ins Ergebnisfeld kommen
  rows?: number;
  extra?: React.ReactNode; // zusätzliche Felder in der Karte (zum Beispiel Titel der Quelle)
  canConfirm?: boolean;
  confirmLabel: string; // z. B. "Bestätigen und weiter zu den Quellen"
  nextHref: string;
  againLabel?: string; // zweite Wahl: speichern und im selben Tool neu beginnen
  onConfirm: (result: string) => void;
  waitingText: string;
  hint: string; // was als Nächstes passiert / Hinweis zur KI
  placeholder?: string;
}

// Gemeinsame Oberfläche aller Tools: Gespräch, darunter das Ergebnis, das der Schüler bestätigt.
export function ChatPanel(p: Props) {
  const { chat } = p;
  const [mode] = useMode();
  const { turns, live, busy, error, needsRetry } = chat;
  const proposed = lastErgebnis(turns);
  const source = proposed ?? p.firstResult;
  const endRef = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState("");
  const userCount = turns.filter((t) => t.role === "user").length;
  const full = userCount >= CHAT.maxUserTurns;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, live]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || busy) return;
    setReply("");
    await chat.send(text);
  }

  const shown = busy ? splitErgebnis(live) : null;

  return (
    <section aria-label="Gespräch" aria-busy={busy}>
      {!busy && turns.length > 0 && (
        <button
          type="button"
          onClick={() => window.confirm("Das Gespräch geht verloren, deine gespeicherte Seminararbeit bleibt. Eingaben ändern und neu starten?") && chat.reset()}
          className="mb-3 text-sm text-zinc-600 underline"
        >
          ← Eingaben ändern und neu starten
        </button>
      )}
      <ol className="flex flex-col gap-3">
        {turns.map((t, i) => (
          <li key={i} className={t.role === "assistant" ? "self-start" : "ml-auto max-w-[90%] self-end"}>
            {t.role === "assistant" ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <FormattedText text={splitErgebnis(t.content).text} />
                {splitErgebnis(t.content).ergebnis && <p className="mt-2 text-sm text-blue-900">Mein Ergebnis-Vorschlag steht unten in der blauen Karte.</p>}
              </div>
            ) : (
              <div className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-3 text-white">{t.content}</div>
            )}
          </li>
        ))}
        {busy && live && shown && (
          <li className="self-start">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <FormattedText text={shown.text} />
              <span className="mt-2 inline-block animate-pulse text-zinc-400">▍</span>
            </div>
          </li>
        )}
      </ol>
      {busy && !live && <div className="mt-3"><Spinner>{p.waitingText}</Spinner></div>}
      {error && (
        <div role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">
          <p>{error}</p>
          {needsRetry && (
            <button type="button" onClick={() => void chat.retry()} className="mt-2 min-h-10 rounded border border-red-300 bg-white px-3 text-sm">
              Nachricht noch einmal senden
            </button>
          )}
        </div>
      )}

      {turns.length > 0 && (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{full ? "Das Gespräch hat sein Limit erreicht. Bestätige das Ergebnis unten." : "Deine Antwort oder Änderungswunsch"}</span>
            <textarea
              className="min-h-24 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={CHAT.maxUserChars}
              disabled={busy || full || needsRetry}
              placeholder={p.placeholder ?? "Antworte auf die Rückfragen oder sag, was du ändern willst …"}
            />
          </label>
          <button disabled={busy || full || needsRetry || !reply.trim()} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
            {busy ? "Die KI antwortet …" : "Senden"}
          </button>
        </form>
      )}

      {turns.length > 0 && !busy && (
        <Result key={source} {...p} source={source} fromAi={!!proposed} showWriteNote={mode === "schreiben"} />
      )}
      <div ref={endRef} />
    </section>
  );
}

function Result(p: Props & { source: string; fromAi: boolean; showWriteNote: boolean }) {
  const router = useRouter();
  const { saveNow } = useWork();
  const [text, setText] = useState(p.source);
  const [saving, setSaving] = useState(false);

  async function confirm(href: string | null) {
    setSaving(true);
    p.onConfirm(text.trim());
    await saveNow();
    setSaving(false);
    if (href) router.push(href);
    else p.chat.reset();
  }

  const ok = !saving && p.canConfirm !== false && text.trim() !== "";
  return (
    <section className="mt-6 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="Ergebnis bestätigen">
      <h2 className="font-semibold">{p.titel}</h2>
      <p className="text-sm text-blue-950">
        {p.fromAi ? "Das ist der Vorschlag aus dem Gespräch." : "Das ist dein aktueller Stand."} Du kannst ihn hier noch ändern. Wenn er für dich passt, bestätige ihn: Er wird in deiner Seminararbeit gespeichert und du gehst zum nächsten Schritt.
      </p>
      {p.suggestions && p.suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Vorschläge der KI zum Einsetzen:</span>
          {p.suggestions.map((s, i) => (
            <button key={`${i}-${s}`} type="button" onClick={() => setText(s)} className="min-h-10 rounded border border-zinc-400 bg-white px-3 py-1 text-left text-sm">
              {s}
            </button>
          ))}
        </div>
      )}
      <textarea
        className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base"
        rows={p.rows ?? 4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={p.titel}
      />
      {p.extra}
      <button type="button" disabled={!ok} onClick={() => void confirm(p.nextHref)} className="min-h-12 rounded bg-blue-900 px-4 text-base text-white disabled:opacity-50">
        {saving ? "Speichere …" : p.confirmLabel}
      </button>
      {p.againLabel && (
        <button type="button" disabled={!ok} onClick={() => void confirm(null)} className="min-h-10 rounded border border-blue-900 bg-white px-3 text-sm text-blue-950 disabled:opacity-50">
          {p.againLabel}
        </button>
      )}
      <p className="text-xs text-zinc-600">{p.showWriteNote ? "Die KI kann sich irren. Prüfe alle Fakten, ersetze „[Beleg nötig]“ durch echte Quellen und gib die KI-Hilfe in deiner Arbeit an." : p.hint}</p>
    </section>
  );
}
