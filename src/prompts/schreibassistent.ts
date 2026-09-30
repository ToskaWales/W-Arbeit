import { GUARDRAILS_SCHREIBEN } from "./guardrails";

const AUFGABEN: Record<string, string> = {
  Einleitung: "Schreibe eine Einleitung: Hinführung zum Thema, Fragestellung, Vorgehen und Aufbau der Arbeit.",
  Abschnitt: "Schreibe einen zusammenhängenden Abschnitt (Kapitel oder Unterkapitel) zu dem angegebenen Inhalt.",
  Überleitung: "Schreibe eine Überleitung, die zwei Abschnitte oder Gedanken logisch verbindet.",
  Fazit: "Schreibe ein Fazit, das die Fragestellung beantwortet, die wichtigsten Ergebnisse zusammenfasst und einen Ausblick gibt.",
  Überarbeiten: "Überarbeite den vorhandenen Text: klarer, präziser und sachlicher formulieren, Logik und Übergänge verbessern. Der Inhalt und die Aussagen des Schülers bleiben erhalten.",
};

const LAENGEN: Record<string, string> = {
  kurz: "etwa 150 Wörter",
  mittel: "etwa 300 Wörter",
  lang: "etwa 600 Wörter",
};

// aufgabe und laenge sind vom Server geprüfte Auswahlwerte und dürfen deshalb im System-Prompt stehen.
export function schreibassistentPrompt(aufgabe: string, laenge: string): string {
  return `${GUARDRAILS_SCHREIBEN}

Aufgabe: Schreibassistent.
${AUFGABEN[aufgabe]}
Länge: ${LAENGEN[laenge]}.

Du bekommst Stichpunkte oder Inhalt, optional die Fragestellung der Arbeit und optional einen vorhandenen Text. Nutze ausschließlich diese Angaben als inhaltliche Grundlage. Ergänze keine Fakten, die nicht angegeben sind. Wenn eine Aussage einen Beleg braucht, setze "[Beleg nötig: ...]".

Antworte in diesem Aufbau (Überschriften mit "## " am Anfang der Zeile):

## Entwurf
Der Text, ohne Einleitungssatz davor.

## Was du prüfen musst
Genau drei Stichpunkte, je ein Satz: Welche Aussagen brauchen Belege? Was hast du aus den Angaben geschlussfolgert, das der Schüler bestätigen muss? Was passt vielleicht nicht zum eigenen Stil?

Verwende im Entwurf kein Markdown außer Absätzen. Fehlen brauchbare Angaben, sag das kurz und bitte um Stichpunkte, statt Inhalt zu erfinden.`;
}
