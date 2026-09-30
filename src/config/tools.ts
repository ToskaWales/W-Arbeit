import type { ModelId } from "./models";

export type ToolId = "fragestellung" | "quellenkritik" | "roter-faden" | "kolloquium" | "schreibassistent";

export interface ToolField {
  key: string;
  label: string;
  maxChars: number;
  required: boolean;
  options?: string[]; // erlaubte Werte (Auswahlfeld)
}

export interface ToolConfig {
  model: ModelId;
  maxTokens: number; // Bei Sonnet zählt das Nachdenken mit, deshalb großzügig.
  effort?: "low" | "medium" | "high";
  // Günstigeres Modell für kurze Zwischenschritte (nur Kolloquium-Fragen; Haiku kennt kein effort).
  askModel?: ModelId;
  fields: ToolField[];
  // Mindest-Restbudget in US-Cent, damit eine einzelne Anfrage das Budget nicht weit überzieht.
  minBudgetCents: number;
}

// Hier legst du pro Tool Modell und Limits fest.
export const TOOLS: Record<ToolId, ToolConfig> = {
  fragestellung: {
    model: "claude-sonnet-5-5",
    maxTokens: 2500,
    effort: "low",
    minBudgetCents: 3,
    fields: [
      { key: "fach", label: "Fach", maxChars: 100, required: true },
      { key: "thema", label: "Thema", maxChars: 300, required: true },
      { key: "fragestellung", label: "Fragestellung", maxChars: 600, required: true },
      { key: "zeitraum", label: "Verfügbarer Zeitraum", maxChars: 100, required: true },
    ],
  },
  quellenkritik: {
    model: "claude-sonnet-5-5",
    maxTokens: 2500,
    effort: "low",
    minBudgetCents: 3,
    fields: [
      { key: "verwendung", label: "Verwendungszweck", maxChars: 400, required: true },
      { key: "text", label: "Quellentext", maxChars: 20000, required: false },
    ],
  },
  "roter-faden": {
    model: "claude-sonnet-5-5",
    maxTokens: 2500,
    effort: "low",
    minBudgetCents: 3,
    fields: [
      { key: "fragestellung", label: "Fragestellung", maxChars: 600, required: true },
      { key: "gliederung", label: "Gliederung", maxChars: 4000, required: true },
    ],
  },
  kolloquium: {
    model: "claude-sonnet-5-5",
    maxTokens: 1500, // Fragen sind kürzer; prepare.ts setzt dafür questionMaxTokens
    effort: "low",
    askModel: "claude-haiku-4-5-20251001", // Feedback bleibt bei Sonnet (Haiku hielt sich dort nicht an die Aufgabe)
    minBudgetCents: 5,
    fields: [
      { key: "kurzfassung", label: "Kurzfassung deiner Arbeit", maxChars: 3000, required: true },
      { key: "schwierigkeit", label: "Schwierigkeitsgrad", maxChars: 20, required: true, options: ["freundlich", "normal", "streng"] },
    ],
  },
  // Nur im Schreibmodus verfügbar (prüft der Server).
  schreibassistent: {
    model: "claude-sonnet-5-5",
    maxTokens: 3000,
    effort: "low",
    minBudgetCents: 5,
    fields: [
      { key: "aufgabe", label: "Aufgabe", maxChars: 20, required: true, options: ["Einleitung", "Abschnitt", "Überleitung", "Fazit", "Überarbeiten"] },
      { key: "laenge", label: "Länge", maxChars: 10, required: true, options: ["kurz", "mittel", "lang"] },
      { key: "fragestellung", label: "Fragestellung der Arbeit", maxChars: 600, required: false },
      { key: "inhalt", label: "Stichpunkte / Inhalt", maxChars: 4000, required: false },
      { key: "text", label: "Vorhandener Text", maxChars: 6000, required: false },
    ],
  },
};

// Maximale Anfragen pro Code und Tag (Redis-Zähler). Ein Kolloquium braucht bis zu 11 Anfragen.
export const DAILY_REQUEST_LIMIT = 100;

// PDF-Upload (Vercel erlaubt etwa 4,5 MB pro Anfrage) und Kostenschutz über die Seitenzahl.
export const PDF_MAX_BYTES = 4 * 1024 * 1024;
export const PDF_MAX_PAGES = 30;
export const PDF_MIN_BUDGET_CENTS = 25;

export const KOLLOQUIUM = {
  maxQuestions: 10,
  maxAnswerChars: 1500,
  maxQuestionChars: 3000,
  questionMaxTokens: 600,
  feedbackMaxTokens: 1500,
  feedbackMaxTokensSchreiben: 2500, // mit Beispielantworten
};
