import type { ModelId } from "./models";

export type ToolId = "fragestellung";

export interface ToolField {
  key: string;
  label: string;
  maxChars: number;
  required: boolean;
}

export interface ToolConfig {
  model: ModelId;
  maxTokens: number; // Bei Sonnet zählt das Nachdenken mit, deshalb großzügig.
  effort?: "low" | "medium" | "high";
  fields: ToolField[];
}

// Hier legst du pro Tool Modell und Limits fest.
export const TOOLS: Record<ToolId, ToolConfig> = {
  fragestellung: {
    model: "claude-sonnet-5-5",
    maxTokens: 3000,
    effort: "low",
    fields: [
      { key: "fach", label: "Fach", maxChars: 100, required: true },
      { key: "thema", label: "Thema", maxChars: 300, required: true },
      { key: "fragestellung", label: "Fragestellung", maxChars: 600, required: true },
      { key: "zeitraum", label: "Verfügbarer Zeitraum", maxChars: 100, required: true },
    ],
  },
};

// Maximale Anfragen pro Code und Tag (Redis-Zähler).
export const DAILY_REQUEST_LIMIT = 50;
