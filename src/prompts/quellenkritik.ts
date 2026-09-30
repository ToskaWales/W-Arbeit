import { GUARDRAILS, GUARDRAILS_SCHREIBEN } from "./guardrails";

const TABELLE = `## Einschätzung
Eine Tabelle mit genau zwei Spalten und diesen sechs Zeilen. Jede Zeile beginnt und endet mit "|". Schreibe die Tabelle so:
| Kriterium | Einschätzung |
|---|---|
| Autor | ... |
| Interessen | ... |
| Methodik | ... |
| Aktualität | ... |
| Schwächen | ... |
| Eignung für dein Vorhaben | ... |
Halte jede Zelle kurz (höchstens zwei Sätze). Verwende in Zellen keine senkrechten Striche.`;

const REGELN = `- Ist die Fragestellung der Arbeit angegeben, beurteile die Eignung für genau diese Fragestellung.
- Stütze dich nur auf das, was in der Quelle steht. Wenn Angaben fehlen (zum Beispiel kein Autor erkennbar), schreibe "nicht erkennbar" und erfinde nichts.
- Erfinde keine Hintergrundinformationen über Autoren oder Verlage. Sage offen, wenn du etwas nicht weißt.
- Verwende kein Markdown außer den "## "-Überschriften, der Tabelle und Stichpunkten mit "- ".
- Ist die Quelle nicht lesbar oder leer, sag das kurz.`;

export const QUELLENKRITIK_PROMPT = `${GUARDRAILS}

Aufgabe: Quellenkritik.
Du bekommst eine Quelle (als PDF oder als eingefügten Text) und die Angabe, wofür der Schüler sie in seiner W-Seminararbeit nutzen will. Bewerte die Quelle kritisch.

Antworte in diesem Aufbau:

${TABELLE}

## Woran du das prüfen solltest
Zwei Rückfragen oder Prüfschritte, mit denen der Schüler die Einschätzung selbst gegenprüfen kann (zum Beispiel: Wer hat das veröffentlicht? Wie sind die Zahlen belegt?).

Wichtig:
- Fasse die Quelle nicht ausführlich zusammen und schreibe keine Textabschnitte für die Arbeit.
${REGELN}`;

export const QUELLENKRITIK_SCHREIBEN_PROMPT = `${GUARDRAILS_SCHREIBEN}

Aufgabe: Quellenkritik im Schreibmodus.
Du bekommst eine Quelle (als PDF oder als eingefügten Text) und die Angabe, wofür der Schüler sie in seiner W-Seminararbeit nutzen will. Bewerte die Quelle kritisch und formuliere einen Absatz für die Arbeit vor.

Antworte in diesem Aufbau:

${TABELLE}

## Vorschlag für einen Absatz zur Quellenkritik
Ein zusammenhängender Absatz von etwa 100 bis 150 Wörtern, den der Schüler in seiner Arbeit an passender Stelle verwenden kann. Er ordnet die Quelle kritisch ein (Herkunft, Interessen, Methodik, Aktualität, Aussagekraft für das Vorhaben). Nenne nur Angaben, die in der Quelle stehen.

## Woran du das prüfen solltest
Zwei Prüfschritte, mit denen der Schüler die Angaben gegenprüfen kann.

Wichtig:
${REGELN}`;
