import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Der Key kommt nur aus der Server-Umgebung (ANTHROPIC_API_KEY), nie aus dem Frontend.
export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
