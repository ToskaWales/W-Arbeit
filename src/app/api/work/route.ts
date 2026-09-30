import { WORK_WRITES_PER_HOUR } from "@/config/work";
import { EncryptionConfigError } from "@/lib/crypto";
import { UNAVAILABLE_MESSAGE } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";
import { authenticateUser } from "@/lib/user-auth";
import { sanitizeWork, WorkError } from "@/lib/work";
import { deleteWork, loadWork, saveWork, VersionConflict } from "@/lib/work-store";

const MAX_BODY_BYTES = 600 * 1024;

function fail(err: unknown) {
  if (err instanceof EncryptionConfigError) {
    console.error("Verschlüsselung nicht eingerichtet:", err.message);
    return Response.json({ error: "Das Speichern der Seminararbeit ist noch nicht eingerichtet." }, { status: 503 });
  }
  console.error("Fehler bei der Seminararbeit:", err instanceof Error ? err.message : err);
  return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const store = getStore();
    const auth = await authenticateUser(request, store, "work");
    if (!auth.ok) return auth.response;
    return Response.json({ work: await loadWork(store, auth.hash) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const store = getStore();
    const auth = await authenticateUser(request, store, "work");
    if (!auth.ok) return auth.response;
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return Response.json({ error: "Die Arbeit ist zu groß." }, { status: 413 });
    }
    if ((await store.bumpCounter(`workwrite:${auth.hash}`, 3600)) > WORK_WRITES_PER_HOUR) {
      return Response.json({ error: "Zu viele Speichervorgänge. Bitte warte kurz." }, { status: 429 });
    }
    let body: { work?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    const work = sanitizeWork(body.work);
    const saved = await saveWork(store, auth.hash, work, work.version);
    return Response.json({ work: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof WorkError) return Response.json({ error: err.message }, { status: 400 });
    if (err instanceof VersionConflict) {
      return Response.json(
        { error: "Deine Arbeit wurde in einem anderen Fenster geändert. Die neueste Fassung wurde geladen.", work: err.current },
        { status: 409 },
      );
    }
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const store = getStore();
    const auth = await authenticateUser(request, store, "work");
    if (!auth.ok) return auth.response;
    await deleteWork(store, auth.hash);
    return Response.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
