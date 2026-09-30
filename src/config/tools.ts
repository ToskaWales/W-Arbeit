import type { ModelId } from "./models";

export type ToolId = "test";

export interface ToolConfig {
  model: ModelId;
  maxTokens: number;
  maxInputChars: number;
  effort?: "low" | "medium" | "high";
}

// Hier legst du pro Tool Modell und Limits fest.
export const TOOLS: Record<ToolId, ToolConfig> = {
  // Nur für den Verbindungstest in M1; wird in M3 durch die echten Tools ersetzt.
  test: { model: "claude-haiku-4-5-20251001", maxTokens: 150, maxInputChars: 500 },
};

// Maximale Anfragen pro Code und Tag (Redis-Zähler).
export const DAILY_REQUEST_LIMIT = 50;
