import { addBudget, renameCode, setActive, setHidden, toRow } from "@/lib/admin-codes";
import { requireAdmin } from "@/lib/admin-guard";
import { getStore } from "@/lib/store";

export async function PATCH(request: Request, ctx: { params: Promise<{ hash: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { hash } = await ctx.params;
  const store = getStore();
  if (!(await store.get(hash))) return Response.json({ error: "Code nicht gefunden." }, { status: 404 });

  let body: { name?: unknown; active?: unknown; hidden?: unknown; addCents?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  try {
    if (body.name !== undefined) await renameCode(store, hash, body.name);
    if (body.active !== undefined) await setActive(store, hash, body.active);
    if (body.hidden !== undefined) await setHidden(store, hash, body.hidden);
    if (body.addCents !== undefined) await addBudget(store, hash, body.addCents);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Fehler." }, { status: 400 });
  }
  const record = await store.get(hash);
  return Response.json({ code: record ? toRow(hash, record) : null });
}
