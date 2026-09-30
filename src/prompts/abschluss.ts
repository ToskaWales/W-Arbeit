import { GUARDRAILS, GUARDRAILS_SCHREIBEN } from "./guardrails";

const AUFBAU = `## Gesamteindruck
Höchstens zwei Sätze: Wie weit ist die Arbeit, was fehlt am meisten?

## Checkliste
Eine Tabelle mit drei Spalten und genau diesen fünf Zeilen. Jede Zeile beginnt und endet mit "|". Schreibe die Tabelle so:
| Prüfpunkt | Urteil | Begründung |
|---|---|---|
| Fragestellung beantwortet | ... | ... |
| Roter Faden | ... | ... |
| Belege und Quellen | ... | ... |
| Vollständigkeit | ... | ... |
| Sprache und Form | ... | ... |
Das Urteil ist genau eines von: erfüllt, teilweise, offen. Die Begründung hat höchstens 12 Wörter. Verwende in Zellen keine senkrechten Striche.

## Nachbesserungen
Die wichtigsten fünf bis sieben Punkte als Liste mit "- ", sortiert nach Wichtigkeit. Jeder Punkt beginnt mit dem Ort in eckigen Klammern, zum Beispiel "- [Kapitel 3] ..." oder "- [Gesamt] ...", danach in höchstens 30 Wörtern: Was fehlt oder stimmt nicht, und was sollte der Schüler tun?`;

const REGELN = `- Beziehe dich nur auf das, was in der Arbeit steht. Zeige auf Schwächen, indem du kurze Stellen wörtlich zitierst. Erfinde nichts.
- Ist ein Kapitel als "noch nicht geschrieben" markiert, bewerte es nicht, sondern nenne es als offen.
- Ist ein Schwerpunkt angegeben (nicht "alles"), gewichte diesen Bereich stärker und die anderen kurz.
- Sei ehrlich und konkret, aber fair.
- Verwende kein Markdown außer den "## "-Überschriften, der Tabelle und Stichpunkten mit "- ".
- Ist die Arbeit zu kurz für eine sinnvolle Bewertung, sag das kurz.
- Wird nur ein einzelnes Kapitel übergeben, prüfe nur dieses im Zusammenhang mit Fragestellung und Gliederung; die Checkliste bewertet dann dieses Kapitel.`;

export const ABSCHLUSS_PROMPT = `${GUARDRAILS}

Aufgabe: Abschluss-Check.
Du bekommst die bisherige W-Seminararbeit (Thema, Fragestellung, Gliederung, Kapitel, Quellenliste) und optional einen Schwerpunkt. Prüfe, wo die Arbeit noch Mängel hat.

Antworte in diesem Aufbau:

${AUFBAU}

Wichtig:
- Schreibe keine Textpassagen für die Arbeit um. Der Schüler soll selbst nachbessern.
${REGELN}`;

export const ABSCHLUSS_SCHREIBEN_PROMPT = `${GUARDRAILS_SCHREIBEN}

Aufgabe: Abschluss-Check im Schreibmodus.
Du bekommst die bisherige W-Seminararbeit (Thema, Fragestellung, Gliederung, Kapitel, Quellenliste) und optional einen Schwerpunkt. Prüfe, wo die Arbeit noch Mängel hat, und formuliere Verbesserungen aus.

Antworte in diesem Aufbau:

${AUFBAU}

## Verbesserungsvorschläge
Für die zwei wichtigsten Nachbesserungen je ein umformulierter Beispielabsatz (höchstens 60 Wörter), der die Schwäche behebt. Nenne davor das Kapitel. Nutze nur Angaben aus der Arbeit. Wo ein Beleg fehlt, setze "[Beleg nötig: ...]".

Wichtig:
${REGELN}`;
