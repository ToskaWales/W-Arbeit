import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Der Key kommt nur aus der Server-Umgebung (ANTHROPIC_API_KEY), nie aus dem Frontend.
export function getAnthropic(): Anthropic {
  // Kürzer als maxDuration der Route (60 s), damit Fehler sauber gemeldet werden können.
  if (!client) client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
  return client;
}
