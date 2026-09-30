import { lookupCode } from "@/lib/access";
import { microToCents } from "@/lib/cost";
import { getStore } from "@/lib/store";

// Anmeldung im Browser: prüft den Code und liefert das Restbudget. Zählt nicht zum Tageslimit.
export async function POST(request: Request) {
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const found = await lookupCode(getStore(), body.code);
  if (!found.ok) return Response.json({ error: found.error }, { status: found.status });
  const rest = found.record.budgetMicro - found.record.costMicro;
  return Response.json({ restCents: Math.max(0, microToCents(rest)) });
}
