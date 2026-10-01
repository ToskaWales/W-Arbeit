import type { Mode } from "../config/mode";
import type { ChatToolId } from "../config/tools";
import { ERGEBNIS_ENDE, ERGEBNIS_START } from "../lib/chat";

// Was im Ergebnis-Block steht, je Tool und Modus. Im Sparring-Modus schreibt die KI nichts für die Arbeit selbst.
const ERGEBNIS: Record<ChatToolId, Record<Mode, string>> = {
  fragestellung: {
    sparring:
      "Die Fragestellung des Schülers als eine einzige Frage in einer Zeile. Nimm nur eine Formulierung, die der Schüler selbst geschrieben hat (wörtlich, höchstens Rechtschreibung korrigieren). Formuliere sie nicht um und biete keine eigene an. Hat er noch keine bessere geschrieben, nimm seine letzte.",
    schreiben: "Deine beste Fragestellung als eine einzige Frage in einer Zeile, auf Basis dessen, was ihr besprochen habt.",
  },
  quellenkritik: {
    sparring: "Die Einschätzung der Quelle in sechs Zeilen im Format „Kriterium: Aussage“ (Autor, Interessen, Methodik, Aktualität, Schwächen, Eignung), jede Aussage höchstens 15 Wörter.",
    schreiben: "Die Einschätzung der Quelle in sechs Zeilen im Format „Kriterium: Aussage“ (Autor, Interessen, Methodik, Aktualität, Schwächen, Eignung), jede Aussage höchstens 15 Wörter. Kein Formulierungsvorschlag im Block.",
  },
  "roter-faden": {
    sparring:
      "Die Gliederung des Schülers, eine Zeile pro Punkt mit Nummerierung (1, 1.1, ...), ohne Erläuterungen. Nimm die Gliederung so, wie der Schüler sie zuletzt selbst geschrieben hat. Baue sie nicht selbst um.",
    schreiben: "Deine beste überarbeitete Gliederung, eine Zeile pro Punkt mit Nummerierung (1, 1.1, ...), ohne Erläuterungen.",
  },
  schreibassistent: {
    sparring: "Nichts (dieses Tool gibt es nur im Schreibmodus).",
    schreiben: "Der aktuelle Entwurf als fertiger Text, ohne Überschrift und ohne die Hinweiszeile zur KI-Kennzeichnung. [Beleg nötig: ...]-Markierungen bleiben darin.",
  },
  abschluss: {
    sparring: "Die wichtigsten Nachbesserungen als Liste mit „- “, jede beginnt mit dem Ort in eckigen Klammern, zum Beispiel „- [Kapitel 3] ...“, höchstens 30 Wörter pro Punkt.",
    schreiben: "Die wichtigsten Nachbesserungen als Liste mit „- “, jede beginnt mit dem Ort in eckigen Klammern, zum Beispiel „- [Kapitel 3] ...“, höchstens 30 Wörter pro Punkt.",
  },
};

// Zusatz zum System-Prompt, sobald der Schüler mit der KI im Gespräch weiterarbeitet.
export function chatPrompt(tool: ChatToolId, mode: Mode, letzteRunde: boolean): string {
  return `Gesprächsmodus: Der Schüler arbeitet jetzt im Gespräch mit dir an diesem Schritt weiter. Deine erste Antwort steht oben im Verlauf. Die Formatvorgaben und Längen oben galten nur für diese erste Antwort. Wiederhole sie nicht.
- Reagiere auf die letzte Nachricht des Schülers: höchstens 100 Wörter, direkt, ohne Einleitung und ohne Lob-Floskeln. Stelle höchstens eine Rückfrage und nur dann, wenn sie für das Ergebnis wirklich nötig ist.
- Ziel ist, so schnell wie möglich zu einem brauchbaren Ergebnis zu kommen. Gib den aktuellen Stand deshalb in jeder Antwort am Ende in genau diesem Block aus, sobald es einen Stand gibt, den der Schüler übernehmen könnte (auch wenn noch Schwächen bestehen, die du in deiner Antwort nennst). Hat der Schüler eine neue Fassung geschickt, ist sie die Grundlage des Blocks. Die Markierungen stehen jeweils allein in einer Zeile:
${ERGEBNIS_START}
...
${ERGEBNIS_ENDE}
  Danach schreibe nichts mehr außer einem Satz an den Schüler in der Du-Form, zum Beispiel: „Wenn das für dich passt, bestätige es unten und geh zum nächsten Schritt, oder sag mir, was ich ändern soll.“ Sprich nie in der dritten Person vom „Schüler“. Ändert sich das Ergebnis, gib den ganzen aktualisierten Block noch einmal aus. Der Block steht höchstens einmal pro Antwort und nie mitten im Text.
- Inhalt des Blocks: ${ERGEBNIS[tool][mode]}
- Der Schüler entscheidet, wann es reicht. Dränge ihn nicht, weiterzumachen, wenn das Ergebnis schon gut genug ist.${letzteRunde ? "\n- Das ist die letzte Runde dieses Gesprächs: Gib jetzt zwingend das Ergebnis im Block aus." : ""}`;
}
