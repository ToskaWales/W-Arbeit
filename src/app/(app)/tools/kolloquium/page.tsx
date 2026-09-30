"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormattedText } from "@/components/formatted-text";
import { ModeNote } from "@/components/mode-note";
import { useMode } from "@/components/mode-store";
import { Spinner } from "@/components/result-view";
import { ApplyButton } from "@/components/apply-button";
import { useToolStream } from "@/components/use-tool-stream";
import { newId, useWork } from "@/components/work-provider";
import { WORK_LIMITS } from "@/config/work";
import { parseLuecken } from "@/lib/answer-parse";
import { KOLLOQUIUM, TOOLS } from "@/config/tools";

interface Turn {
  role: "assistant" | "user";
  content: string;
}
type Stage = "setup" | "chat" | "done";

const max = Object.fromEntries(TOOLS.kolloquium.fields.map((f) => [f.key, f.maxChars]));
const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";
const LEVELS = [
  { value: "freundlich", label: "Freundlich", hint: "Ermutigend, wenig Nachhaken" },
  { value: "normal", label: "Normal", hint: "Sachlich und fair" },
  { value: "streng", label: "Streng", hint: "Kritisch, verlangt Belege" },
] as const;

export default function KolloquiumPage() {
  const { work, loaded } = useWork();
  if (!loaded) return <main className="text-zinc-600">Lade deine Seminararbeit …</main>;
  return <Kolloquium initialKurzfassung={work.kurzfassung} />;
}

function Kolloquium({ initialKurzfassung }: { initialKurzfassung: string }) {
  const { work, update } = useWork();
  const [mode] = useMode();
  const { phase, answer, error, busy, run, reset } = useToolStream();
  const [stage, setStage] = useState<Stage>("setup");
  const [kurzfassung, setKurzfassung] = useState(initialKurzfassung);
  const [kurzGespeichert, setKurzGespeichert] = useState(false);
  const hatStruktur = !!(work.fragestellung.trim() && work.gliederung.trim());
  const [schwierigkeit, setSchwierigkeit] = useState<(typeof LEVELS)[number]["value"]>("normal");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const fields = { kurzfassung, schwierigkeit };
  const questions = turns.filter((t) => t.role === "assistant").length;
  const waitingForAnswer = turns.length > 0 && turns[turns.length - 1].role === "assistant";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, answer, stage]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const q = await run({ json: { tool: "kolloquium", fields, history: [] } });
    if (q) {
      setTurns([{ role: "assistant", content: q.trim() }]);
      setStage("chat");
      reset();
    }
  }

  // Schickt die Antwort. Nach der letzten Frage (oder auf Wunsch) kommt das Abschlussfeedback.
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const history = [...turns, { role: "user" as const, content: reply.trim() }];
    const last = questions >= KOLLOQUIUM.maxQuestions;
    const result = await run({ json: { tool: "kolloquium", fields, history, finish: last } });
    if (!result) return; // Fehler: Antwort bleibt im Feld, du kannst es noch einmal versuchen
    setReply("");
    if (last) {
      setTurns(history);
      setFeedback(result.trim());
      setStage("done");
      update((w) => ({ ...w, meilensteine: { ...w.meilensteine, kolloquium: Date.now() } }));
    } else {
      setTurns([...history, { role: "assistant", content: result.trim() }]);
    }
    reset();
  }

  async function finish() {
    // Eine unbeantwortete letzte Frage zählt nicht mit.
    const history = waitingForAnswer && reply.trim() === "" ? turns.slice(0, -1) : [...turns, { role: "user" as const, content: reply.trim() }];
    if (history.length === 0) return restart();
    const result = await run({ json: { tool: "kolloquium", fields, history, finish: true } });
    if (!result) return;
    setTurns(history);
    setReply("");
    setFeedback(result.trim());
    setStage("done");
    update((w) => ({ ...w, meilensteine: { ...w.meilensteine, kolloquium: Date.now() } }));
    reset();
  }

  function restart() {
    setStage("setup");
    setTurns([]);
    setReply("");
    setFeedback("");
    reset();
  }

  const header = (
    <>
      <Link href="/" className="text-sm text-zinc-600 underline">← Zurück</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Kolloquiums-Simulator</h1>
    </>
  );

  if (stage === "setup") {
    return (
      <main>
        {header}
        <p className="mb-5 text-zinc-600">
          Die KI stellt dir wie in der Prüfung Fragen zu deiner Arbeit, eine nach der anderen. Nach höchstens {KOLLOQUIUM.maxQuestions} Fragen bekommst du ein Feedback.
          {mode === "schreiben" && " Im Feedback bekommst du außerdem Beispielantworten."}
        </p>
        <ModeNote />
        <form onSubmit={start} className="flex flex-col gap-4">
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
            Bitte schreibe keine Namen (auch nicht deinen) und keinen Schulnamen in die Kurzfassung.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Kurzfassung deiner Arbeit</span>
            <textarea
              className={`${input} min-h-48`}
              value={kurzfassung}
              onChange={(e) => setKurzfassung(e.target.value)}
              maxLength={max.kurzfassung}
              placeholder="Worum geht es? Was ist deine Fragestellung, wie bist du vorgegangen und zu welchem Ergebnis kommst du?"
              required={!hatStruktur}
              onInput={() => setKurzGespeichert(false)}
            />
            <span className="text-xs text-zinc-500">{kurzfassung.length} / {max.kurzfassung} Zeichen</span>
          </label>
          <p className="rounded bg-blue-50 p-3 text-sm text-blue-950">
            Die KI kennt auch Fragestellung, Gliederung und Quellenliste aus deiner Seminararbeit und fragt gezielt danach.
            {!hatStruktur && " Sie sind noch nicht vollständig gespeichert, deshalb brauchst du hier eine Kurzfassung."}
          </p>
          <button type="button" disabled={!kurzfassung.trim()} onClick={() => { update((w) => ({ ...w, kurzfassung: kurzfassung.trim() })); setKurzGespeichert(true); }} className="min-h-10 rounded border border-zinc-400 px-3 text-sm disabled:opacity-50">
            {kurzGespeichert ? "✓ Kurzfassung gespeichert" : "Kurzfassung in meiner Seminararbeit speichern"}
          </button>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Schwierigkeitsgrad</legend>
            {LEVELS.map((l) => (
              <label key={l.value} className={`flex min-h-12 items-center gap-3 rounded border px-3 ${schwierigkeit === l.value ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"}`}>
                <input type="radio" name="level" checked={schwierigkeit === l.value} onChange={() => setSchwierigkeit(l.value)} />
                <span><strong>{l.label}</strong> <span className="text-sm text-zinc-600">– {l.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <button disabled={busy} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
            {busy ? "Die KI bereitet sich vor …" : "Gespräch starten"}
          </button>
        </form>
        {phase === "waiting" && <div className="mt-4"><Spinner>Die KI liest deine Kurzfassung …</Spinner></div>}
        {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}
      </main>
    );
  }

  return (
    <main>
      {header}
      <p className="mb-4 text-sm text-zinc-600">
        {stage === "chat" ? `Frage ${Math.min(questions, KOLLOQUIUM.maxQuestions)} von ${KOLLOQUIUM.maxQuestions}` : "Gespräch beendet"} · Der Verlauf bleibt nur in deinem Browser. Wenn du die Seite neu lädst, ist er weg.
      </p>

      <ol className="flex flex-col gap-3" aria-label="Gespräch">
        {turns.map((t, i) => (
          <li key={i} className={`max-w-[90%] rounded-lg p-3 ${t.role === "assistant" ? "self-start border border-zinc-200 bg-white" : "self-end bg-zinc-900 text-white"}`}>
            <span className="mb-1 block text-xs opacity-70">{t.role === "assistant" ? "Prüfer" : "Du"}</span>
            <span className="whitespace-pre-wrap">{t.content}</span>
          </li>
        ))}
        {busy && answer && stage === "chat" && (
          <li className="max-w-[90%] self-start rounded-lg border border-zinc-200 bg-white p-3">
            <span className="mb-1 block text-xs opacity-70">Prüfer</span>
            <span className="whitespace-pre-wrap">{answer}</span>
            <span className="animate-pulse text-zinc-400"> ▍</span>
          </li>
        )}
      </ol>

      {busy && !answer && <div className="mt-3"><Spinner>{questions > KOLLOQUIUM.maxQuestions - 1 ? "Die KI wertet dein Gespräch aus …" : "Der Prüfer überlegt …"}</Spinner></div>}

      {stage === "chat" && (
        <form onSubmit={send} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Deine Antwort</span>
            <textarea
              className={`${input} min-h-28`}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={KOLLOQUIUM.maxAnswerChars}
              disabled={busy}
              required
            />
            <span className="text-xs text-zinc-500">{reply.length} / {KOLLOQUIUM.maxAnswerChars} Zeichen</span>
          </label>
          <div className="flex gap-2">
            <button disabled={busy || reply.trim() === ""} className="min-h-12 flex-1 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
              {questions >= KOLLOQUIUM.maxQuestions ? "Antworten und Feedback holen" : "Antwort senden"}
            </button>
            <button type="button" onClick={finish} disabled={busy} className="min-h-12 rounded border border-zinc-400 px-4 text-base disabled:opacity-50">
              Beenden
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}

      {stage === "done" && (
        <>
          <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4" aria-label="Abschlussfeedback">
            <FormattedText text={feedback} />
          </section>
          <p className="mt-3 text-sm text-zinc-500">Die KI kann sich irren. Nimm die Tipps als Anregung und übe in eigenen Worten.</p>
          {parseLuecken(feedback).length > 0 && (
            <section className="mt-4 flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4" aria-label="Lücken übernehmen">
              <h2 className="font-semibold">{parseLuecken(feedback).length} Lücken als offene Punkte übernehmen</h2>
              <ApplyButton
                label="Als offene Punkte speichern"
                onApply={() =>
                  update((w) => {
                    const vorhanden = new Set(w.punkte.map((p) => p.text.trim().toLowerCase()));
                    const neu = parseLuecken(feedback)
                      .map((t) => t.replace(/\s+/g, " ").trim().slice(0, WORK_LIMITS.punktText))
                      .filter((t) => t && !vorhanden.has(t.toLowerCase()))
                      .map((text) => ({ id: newId(), text, herkunft: "kolloquium" as const, erledigt: false }));
                    return { ...w, punkte: [...w.punkte, ...neu].slice(0, WORK_LIMITS.maxPunkte) };
                  })
                }
              />
              <p className="text-xs text-zinc-600">Damit verbesserst du danach im Schreibassistenten gezielt die Stellen, an denen es noch fehlt.</p>
            </section>
          )}
          <button onClick={restart} className="mt-4 min-h-12 w-full rounded bg-zinc-900 px-4 text-base text-white">Neues Gespräch</button>
        </>
      )}
      <div ref={endRef} />
    </main>
  );
}
