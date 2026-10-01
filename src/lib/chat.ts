// Gesprächsverlauf der Tools (Browser und Server). Der Verlauf bleibt nur im Browser (Session Storage);
// gespeichert wird allein das Ergebnis, das der Schüler bestätigt.

export interface Turn {
  role: "assistant" | "user";
  content: string;
}

export const ERGEBNIS_START = "[ERGEBNIS]";
export const ERGEBNIS_ENDE = "[/ERGEBNIS]";

// Trennt den Ergebnis-Block vom restlichen Text. `offen` = der Block ist noch nicht abgeschlossen (die Antwort läuft noch).
export function splitErgebnis(text: string): { text: string; ergebnis: string | null; offen: boolean } {
  const i = text.indexOf(ERGEBNIS_START);
  if (i < 0) return { text, ergebnis: null, offen: false };
  const before = text.slice(0, i);
  const after = text.slice(i + ERGEBNIS_START.length);
  const j = after.indexOf(ERGEBNIS_ENDE);
  if (j < 0) return { text: before.trim(), ergebnis: after.trim(), offen: true };
  return { text: `${before}${after.slice(j + ERGEBNIS_ENDE.length)}`.trim(), ergebnis: after.slice(0, j).trim(), offen: false };
}

// Das jüngste Ergebnis, das die KI vorgeschlagen hat (null, wenn es noch keins gab).
export function lastErgebnis(turns: Turn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "assistant") continue;
    const { ergebnis, offen } = splitErgebnis(turns[i].content);
    if (ergebnis && !offen) return ergebnis;
  }
  return null;
}
