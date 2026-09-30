"use client";

import { useCallback, useSyncExternalStore } from "react";
import { splitMeta } from "@/lib/meta";
import { getStream, IDLE, isRunning, setStream, signature, subscribe, type Phase } from "@/lib/tool-store";
import { useAccess } from "./access-provider";
import { useMode } from "./mode-store";
import { useWork } from "./work-provider";

export type { Phase };

function withMode(form: FormData | undefined, mode: string) {
  form?.set("mode", mode);
  return form;
}

const AGAIN = "Diese Eingabe hast du schon berechnen lassen. Das Ergebnis siehst du weiter unten. Nochmal berechnen kostet erneut Budget. Trotzdem neu berechnen?";

// Schickt eine Anfrage an /api/claude und zeigt die Antwort live an.
// Der Zustand liegt im tool-store (pro Tool und Modus): Wer die Seite verlässt und zurückkommt, sieht das fertige
// oder noch laufende Ergebnis, ohne dass etwas doppelt berechnet wird.
// Gibt am Ende den vollständigen Text zurück (oder null, wenn etwas schiefging oder nichts Neues berechnet wurde).
export function useToolStream(tool: string) {
  const { code, refreshBudget, logout } = useAccess();
  const [mode] = useMode();
  const { saveNow } = useWork();
  const key = `${tool}:${mode}`; // jeder Modus behält sein eigenes Ergebnis
  const state = useSyncExternalStore(subscribe, () => getStream(key), () => IDLE);

  const reset = useCallback(() => setStream(key, IDLE), [key]);

  const run = useCallback(
    async (payload: { json?: object; form?: FormData }): Promise<string | null> => {
      if (isRunning(key)) return null; // läuft schon (zum Beispiel nach Zurückgehen): nicht doppelt starten
      const sig = signature(payload, mode);
      const cur = getStream(key);
      if (cur.phase === "done" && cur.sig === sig && !window.confirm(AGAIN)) return null;

      setStream(key, { ...IDLE, phase: "waiting" });
      // Die Tools lesen die Arbeit auf dem Server: zuerst alles Ungespeicherte sichern.
      await saveNow();

      const fail = (error: string, keep = "") => setStream(key, { ...IDLE, phase: "error", error, answer: keep });

      let res: Response;
      try {
        res = await fetch("/api/claude", {
          method: "POST",
          headers: { "x-access-code": code, ...(payload.json ? { "Content-Type": "application/json" } : {}) },
          body: payload.json ? JSON.stringify({ ...payload.json, mode }) : withMode(payload.form, mode),
        });
      } catch {
        fail("Keine Verbindung. Prüfe dein Internet und versuche es noch einmal.");
        return null;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fail(data.error ?? (res.status === 413 ? "Die Datei ist zu groß." : "Etwas ist schiefgegangen. Bitte versuche es noch einmal."));
        if (res.status === 401 || res.status === 403) logout(); // Code ungültig oder gesperrt
        if (res.status === 402) void refreshBudget();
        return null;
      }

      let full = "";
      try {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          const shown = splitMeta(full);
          setStream(key, { ...IDLE, phase: "streaming", answer: shown.text, treffer: shown.treffer });
        }
      } catch {
        fail("Die Verbindung wurde unterbrochen. Die Antwort ist unvollständig.", splitMeta(full).text);
        void refreshBudget();
        return null;
      }
      const shown = splitMeta(full);
      setStream(key, { phase: "done", answer: shown.text, error: "", treffer: shown.treffer, sig });
      void refreshBudget();
      return shown.text;
    },
    [key, mode, code, saveNow, refreshBudget, logout],
  );

  return {
    phase: state.phase,
    answer: state.answer,
    error: state.error,
    treffer: state.treffer,
    busy: state.phase === "waiting" || state.phase === "streaming",
    run,
    reset,
  };
}
