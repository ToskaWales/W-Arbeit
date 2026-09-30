import { createCodeForName, toRow } from "@/lib/admin-codes";
import { requireAdmin } from "@/lib/admin-guard";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = (await getStore().list()).map(({ hash, record }) => toRow(hash, record));
  rows.sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ codes: rows });
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: { name?: unknown; budgetCents?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  try {
    const { code, name } = await createCodeForName(getStore(), body.name, body.budgetCents);
    // Der Klartext-Code wird nur in dieser einen Antwort gezeigt.
    return Response.json({ code, name }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Fehler." }, { status: 400 });
  }
}
