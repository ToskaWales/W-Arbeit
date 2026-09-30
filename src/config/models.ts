// Preise in US-Cent pro 1 Million Tokens (Quelle: platform.claude.com/docs/en/about-claude/pricing,
// Stand 30.09.2026). Bei Preisänderungen nur diese Datei anpassen.
export type ModelId = "claude-haiku-4-5-20251001" | "claude-sonnet-5-5";

export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheRead: number;
}

// Websuche: 10 $ pro 1.000 Suchen (Quelle: Anthropic-Preisseite, Stand 30.09.2026), also 1 Cent pro Suche.
export const WEB_SEARCH_CENTS_PER_REQUEST = 1;

export const MODEL_PRICES: Record<ModelId, ModelPrice> = {
  "claude-haiku-4-5-20251001": { input: 100, output: 500, cacheWrite5m: 125, cacheRead: 10 },
  "claude-sonnet-5-5": { input: 200, output: 1000, cacheWrite5m: 250, cacheRead: 20 },
};
