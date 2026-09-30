"use client";

import { useCallback, useState } from "react";
import { useAccess } from "./access-provider";

export type Phase = "idle" | "waiting" | "streaming" | "done" | "error";

// Schickt eine Anfrage an /api/claude und zeigt die Antwort live an.
// Gibt am Ende den vollständigen Text zurück (oder null, wenn etwas schiefging).
export function useToolStream() {
  const { code, refreshBudget, logout } = useAccess();
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setPhase("idle");
    setAnswer("");
    setError("");
  }, []);

  const run = useCallback(
    async (payload: { json?: object; form?: FormData }): Promise<string | null> => {
      setError("");
      setAnswer("");
      setPhase("waiting");

      let res: Response;
      try {
        res = await fetch("/api/claude", {
          method: "POST",
          headers: {
            "x-access-code": code,
            ...(payload.json ? { "Content-Type": "application/json" } : {}),
          },
          body: payload.json ? JSON.stringify(payload.json) : payload.form,
        });
      } catch {
        setError("Keine Verbindung. Prüfe dein Internet und versuche es noch einmal.");
        setPhase("error");
        return null;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ??
            (res.status === 413 ? "Die Datei ist zu groß." : "Etwas ist schiefgegangen. Bitte versuche es noch einmal."),
        );
        if (res.status === 401 || res.status === 403) logout(); // Code ungültig oder gesperrt
        if (res.status === 402) void refreshBudget();
        setPhase("error");
        return null;
      }

      let full = "";
      try {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setPhase("streaming");
          full += decoder.decode(value, { stream: true });
          setAnswer(full);
        }
      } catch {
        setError("Die Verbindung wurde unterbrochen. Die Antwort ist unvollständig.");
        setPhase("error");
        void refreshBudget();
        return null;
      }
      setPhase("done");
      void refreshBudget();
      return full;
    },
    [code, refreshBudget, logout],
  );

  return { phase, answer, error, busy: phase === "waiting" || phase === "streaming", run, reset };
}
