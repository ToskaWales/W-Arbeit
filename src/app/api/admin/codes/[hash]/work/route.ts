import { requireAdmin } from "@/lib/admin-guard";
import { getStore } from "@/lib/store";
import { deleteWork } from "@/lib/work-store";

// Löscht nur die gespeicherte Seminararbeit dieses Codes (Datenschutz-Anfragen), nicht den Code selbst.
export async function DELETE(request: Request, ctx: { params: Promise<{ hash: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { hash } = await ctx.params;
  const store = getStore();
  if (!(await store.get(hash))) return Response.json({ error: "Code nicht gefunden." }, { status: 404 });
  await deleteWork(store, hash);
  return Response.json({ ok: true });
}
