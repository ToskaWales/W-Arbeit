import { lookupCode } from "./access";
import { BLOCKED_MESSAGE, clientKey, isBlocked, recordFailure } from "./rate-limit";
import type { CodeStore } from "./store/types";

// Anmeldung für Nutzer-Endpunkte: Code im Header, mit Bremse gegen Raten. Zählt nicht zum Tageslimit.
export async function authenticateUser(request: Request, store: CodeStore, scope: string) {
  const client = clientKey(request);
  if (await isBlocked(store, scope, client)) {
    return { ok: false as const, response: Response.json({ error: BLOCKED_MESSAGE }, { status: 429 }) };
  }
  const code = request.headers.get("x-access-code");
  const found = await lookupCode(store, code);
  if (!found.ok) {
    if (found.status === 401 && code?.trim()) await recordFailure(store, scope, client);
    return { ok: false as const, response: Response.json({ error: found.error }, { status: found.status }) };
  }
  return { ok: true as const, hash: found.hash };
}
