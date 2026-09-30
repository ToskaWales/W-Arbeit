import type { ModelId } from "./models";

export type ToolId = "fragestellung" | "quellenkritik" | "roter-faden" | "kolloquium" | "schreibassistent" | "abschluss" | "quellensuche";

export interface ToolField {
  key: string;
  label: string;
  maxChars: number;
  required: boolean;
  options?: string[]; // erlaubte Werte (Auswahlfeld)
  hidden?: boolean; // wird geprüft, aber nicht an die KI geschickt (Steuerfeld)
}

export interface ToolConfig {
  model: ModelId;
  maxTokens: number; // Bei Sonnet zählt das Nachdenken mit, deshalb großzügig.
  effort?: "low" | "medium" | "high";
  // Günstigeres Modell für kurze Zwischenschritte (nur Kolloquium-Fragen; Haiku kennt kein effort).
  askModel?: ModelId;
  // Braucht die gespeicherte Seminararbeit als Kontext (der Server lädt sie selbst, der Browser schickt sie nicht mit).
  usesWork?: boolean;
  // Websuche (Server-Werkzeug von Anthropic), Höchstzahl Suchen pro Anfrage.
  webSearchMaxUses?: number;
  fields: ToolField[];
  // Mindest-Restbudget in US-Cent, damit eine einzelne Anfrage das Budget nicht weit überzieht.
  minBudgetCents: number;
}

// Hier legst du pro Tool Modell und Limits fest.
export const TOOLS: Record<ToolId, ToolConfig> = {
  fragestellung: {
    model: "claude-sonnet-5-5",
    maxTokens: 1500,
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
    maxTokens: 1500,
    effort: "low",
    minBudgetCents: 3,
    usesWork: true,
    fields: [
      { key: "verwendung", label: "Verwendungszweck", maxChars: 400, required: true },
      { key: "text", label: "Quellentext", maxChars: 20000, required: false },
    ],
  },
  "roter-faden": {
    model: "claude-sonnet-5-5",
    maxTokens: 1500,
    effort: "low",
    minBudgetCents: 3,
    usesWork: true,
    fields: [
      { key: "fragestellung", label: "Fragestellung", maxChars: 600, required: true },
      { key: "gliederung", label: "Gliederung", maxChars: 4000, required: true },
      { key: "mitTexten", label: "Geschriebene Kapitel prüfen", maxChars: 4, required: false, options: ["ja", "nein"], hidden: true },
    ],
  },
  kolloquium: {
    model: "claude-sonnet-5-5",
    maxTokens: 1000, // Fragen sind kürzer; prepare.ts setzt dafür questionMaxTokens
    effort: "low",
    askModel: "claude-haiku-4-5-20251001", // Feedback bleibt bei Sonnet (Haiku hielt sich dort nicht an die Aufgabe)
    minBudgetCents: 5,
    usesWork: true,
    fields: [
      { key: "kurzfassung", label: "Kurzfassung deiner Arbeit", maxChars: 3000, required: false },
      { key: "schwierigkeit", label: "Schwierigkeitsgrad", maxChars: 20, required: true, options: ["freundlich", "normal", "streng"] },
    ],
  },
  // Nur im Schreibmodus verfügbar (prüft der Server).
  schreibassistent: {
    model: "claude-sonnet-5-5",
    maxTokens: 3000,
    effort: "low",
    minBudgetCents: 5,
    usesWork: true,
    fields: [
      { key: "aufgabe", label: "Aufgabe", maxChars: 20, required: true, options: ["Einleitung", "Abschnitt", "Überleitung", "Fazit", "Überarbeiten"] },
      { key: "laenge", label: "Länge", maxChars: 10, required: true, options: ["kurz", "mittel", "lang"] },
      { key: "fragestellung", label: "Fragestellung der Arbeit", maxChars: 600, required: false },
      { key: "inhalt", label: "Stichpunkte / Inhalt", maxChars: 4000, required: false },
      { key: "text", label: "Vorhandener Text", maxChars: 6000, required: false },
      { key: "kapitelId", label: "Kapitel", maxChars: 40, required: false, hidden: true },
    ],
  },
  // Liest die ganze gespeicherte Arbeit und listet Stellen zum Nachbessern.
  abschluss: {
    model: "claude-sonnet-5-5",
    maxTokens: 2200,
    effort: "low",
    minBudgetCents: 15,
    usesWork: true,
    fields: [
      { key: "fokus", label: "Schwerpunkt", maxChars: 30, required: false, options: ["alles", "Fragestellung", "Roter Faden", "Quellen", "Sprache und Form"] },
      // Nur ein Kapitel prüfen (spart Tokens beim Nachbessern, weil nicht die ganze Arbeit neu gelesen wird)
      { key: "kapitelId", label: "Kapitel", maxChars: 40, required: false, hidden: true },
    ],
  },
  // Sucht im Internet nach besseren Quellen (Websuche kostet extra, deshalb hohes Mindestbudget).
  quellensuche: {
    model: "claude-sonnet-5-5",
    maxTokens: 1500,
    effort: "low",
    minBudgetCents: 10,
    usesWork: true,
    webSearchMaxUses: 1, // gemessen: eine Suche liefert fast dasselbe wie zwei, kostet aber etwa ein Drittel weniger
    fields: [
      { key: "suchauftrag", label: "Wofür brauchst du bessere Quellen?", maxChars: 500, required: true },
      { key: "schwacheQuelle", label: "Bisherige Quelle und ihre Schwäche", maxChars: 600, required: false },
    ],
  },
};

// Maximale Anfragen pro Code und Tag (Redis-Zähler). Ein Kolloquium braucht bis zu 11 Anfragen.
export const DAILY_REQUEST_LIMIT = 100;

// PDF-Upload (Vercel erlaubt etwa 4,5 MB pro Anfrage) und Kostenschutz über die Seitenzahl.
export const PDF_MAX_BYTES = 4 * 1024 * 1024;
export const PDF_MAX_PAGES = 30;
export const PDF_MIN_BUDGET_CENTS = 25;

// Abschluss-Check nur für ein Kapitel: deutlich günstiger, deshalb kleineres Mindestbudget.
export const ABSCHLUSS_KAPITEL_MIN_BUDGET_CENTS = 5;
export const ABSCHLUSS_KAPITEL_MIN_CHARS = 100;

export const KOLLOQUIUM = {
  maxQuestions: 10,
  maxAnswerChars: 1500,
  maxQuestionChars: 3000,
  questionMaxTokens: 300,
  feedbackMaxTokens: 1000,
  feedbackMaxTokensSchreiben: 1600, // mit Beispielantworten
};
