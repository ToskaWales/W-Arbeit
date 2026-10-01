"use client";

import { useCallback } from "react";
import type { Turn } from "@/lib/chat";
import type { ChatToolId } from "@/config/tools";
import { useMode } from "./mode-store";
import { useStoredValue } from "./use-stored";
import { useToolStream } from "./use-tool-stream";

interface ChatState {
  turns: Turn[];
  base: object | null; // Anfrage der ersten Runde (ohne PDF), wird bei jeder Folgerunde wieder mitgeschickt
}
const EMPTY: ChatState = { turns: [], base: null };

// Gespräch mit einem Tool: erste Antwort aus dem Formular, danach Chat bis zum bestätigten Ergebnis.
// Der Verlauf bleibt im Browser (Session Storage, pro Tool und Modus) und geht beim Abmelden verloren.
export function useToolChat(tool: ChatToolId) {
  const [mode] = useMode();
  const stream = useToolStream(tool);
  const [state, setState] = useStoredValue<ChatState>(`${tool}:chat:${mode}`, EMPTY);
  const { turns, base } = state;
  const { run, reset: resetStream } = stream;

  // Erste Runde. `followBase` ist die Anfrage für Folgerunden (bei einem PDF ohne die Datei).
  const start = useCallback(
    async (payload: { json?: object; form?: FormData }, followBase: object): Promise<string | null> => {
      if (turns.length > 0 && !window.confirm("Dein bisheriges Gespräch zu diesem Schritt geht dabei verloren. Neu starten?")) return null;
      setState(EMPTY);
      resetStream(); // sonst fragt der Schutz vor Doppelberechnung noch einmal nach
      const text = await run(payload);
      if (text === null) return null;
      setState({ turns: [{ role: "assistant", content: text.trim() }], base: followBase });
      return text;
    },
    [turns.length, setState, resetStream, run],
  );

  const ask = useCallback(
    async (history: Turn[]) => {
      if (!base) return;
      const text = await run({ json: { ...base, history } });
      if (text !== null) setState((p) => ({ ...p, turns: [...history, { role: "assistant", content: text.trim() }] }));
    },
    [base, run, setState],
  );

  const send = useCallback(
    async (message: string) => {
      const history: Turn[] = [...turns, { role: "user", content: message.trim() }];
      setState((p) => ({ ...p, turns: history })); // sofort sichtbar; bei einem Fehler bleibt sie stehen
      await ask(history);
    },
    [turns, setState, ask],
  );

  // Nach einem Fehler dieselbe Nachricht noch einmal schicken.
  const retry = useCallback(() => ask(turns), [turns, ask]);

  const reset = useCallback(() => {
    setState(EMPTY);
    resetStream();
  }, [setState, resetStream]);

  return {
    turns,
    live: stream.answer, // Antwort, die gerade eintrifft
    phase: stream.phase,
    error: stream.error,
    busy: stream.busy,
    // Die letzte Nachricht ist vom Schüler und hat keine Antwort bekommen (Fehler): erneut senden.
    needsRetry: turns.length > 0 && turns[turns.length - 1].role === "user" && !stream.busy,
    start,
    send,
    retry,
    reset,
  };
}

export type ToolChat = ReturnType<typeof useToolChat>;
