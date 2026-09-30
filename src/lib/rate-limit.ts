import { createHash } from "node:crypto";
import type { CodeStore } from "./store/types";

export const FAIL_MAX = 20; // falsche Codes pro Anschluss und Fenster (an einer Schule teilen sich viele eine IP)
export const FAIL_WINDOW_SECONDS = 15 * 60;

// Die IP-Adresse wird nie im Klartext gespeichert, nur ein kurzer Hash, der nach 15 Minuten verschwindet.
export function clientKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unbekannt";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

const key = (scope: string, client: string) => `fail:${scope}:${client}`;

export async function isBlocked(store: CodeStore, scope: string, client: string): Promise<boolean> {
  return (await store.getCounter(key(scope, client))) >= FAIL_MAX;
}

export async function recordFailure(store: CodeStore, scope: string, client: string): Promise<void> {
  await store.bumpCounter(key(scope, client), FAIL_WINDOW_SECONDS);
}

export const BLOCKED_MESSAGE = "Zu viele falsche Codes von diesem Anschluss. Bitte warte 15 Minuten.";
export const BUSY_MESSAGE = "Bitte warte, bis deine letzte Anfrage fertig ist.";
export const UNAVAILABLE_MESSAGE = "Der Dienst ist gerade nicht erreichbar. Bitte versuche es in ein paar Minuten noch einmal.";
