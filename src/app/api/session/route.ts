import { lookupCode } from "@/lib/access";
import { microToCents } from "@/lib/cost";
import { BLOCKED_MESSAGE, UNAVAILABLE_MESSAGE, clientKey, isBlocked, recordFailure } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

// Anmeldung im Browser: prüft den Code und liefert das Restbudget. Zählt nicht zum Tageslimit.
export async function POST(request: Request) {
  try {
    const store = getStore();
    const client = clientKey(request);
    if (await isBlocked(store, "session", client)) {
      return Response.json({ error: BLOCKED_MESSAGE }, { status: 429 });
    }
    let body: { code?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    const found = await lookupCode(store, body.code);
    if (!found.ok) {
      if (found.status === 401 && typeof body.code === "string" && body.code.trim()) {
        await recordFailure(store, "session", client); // Raten bremsen
      }
      return Response.json({ error: found.error }, { status: found.status });
    }
    const rest = found.record.budgetMicro - found.record.costMicro;
    return Response.json({ restCents: Math.max(0, microToCents(rest)) });
  } catch (err) {
    console.error("Unerwarteter Fehler:", err instanceof Error ? err.message : err);
    return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}
