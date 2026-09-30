import { MODEL_PRICES, WEB_SEARCH_CENTS_PER_REQUEST, type ModelId } from "../config/models";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

// Kosten werden in Mikro-Cent (1 Cent = 1.000.000) als ganze Zahl gerechnet,
// damit keine Rundungsfehler durch Kommazahlen entstehen.
// Tokens × (Cent pro Million Tokens) = Mikro-Cent.
export const MICRO_PER_CENT = 1_000_000;

export function calculateCostMicroCents(model: ModelId, usage: Usage): number {
  const price = MODEL_PRICES[model];
  if (!price) throw new Error(`Unbekanntes Modell: ${model}`);
  return (
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite5m +
    (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
    (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_CENTS_PER_REQUEST * MICRO_PER_CENT
  );
}

export function microToCents(micro: number): number {
  return micro / MICRO_PER_CENT;
}
