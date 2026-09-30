import { createCodeForName, toRow } from "@/lib/admin-codes";
import { requireAdmin } from "@/lib/admin-guard";
import { MARKUP_PERCENT, usdToEur } from "@/config/pricing";
import { EncryptionConfigError, getEncryptionKey } from "@/lib/crypto";
import { getStore } from "@/lib/store";

// Prüft, ob wichtige Einstellungen fehlen, und sagt dem Admin, was zu tun ist (nur nach Admin-Login sichtbar).
function setupCheck() {
  const problems: string[] = [];
  try {
    getEncryptionKey();
  } catch (err) {
    if (err instanceof EncryptionConfigError) {
      problems.push(
        "WORK_ENCRYPTION_KEY fehlt oder ist ungültig. Solange das so ist, können Schüler ihre Seminararbeit nicht speichern und die Tools nutzen sie nicht. Schlüssel erzeugen (npm run key) und in den Umgebungsvariablen eintragen, dann neu deployen.",
      );
    }
  }
  return { problems };
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = (await getStore().list()).map(({ hash, record }) => toRow(hash, record));
  rows.sort((a, b) => b.createdAt - a.createdAt);
  // Der Aufschlag wird nur hier ausgeliefert (nach Admin-Login) und steckt nie im Code, den jeder Besucher laden kann.
  return Response.json({
    codes: rows,
    markupPercent: MARKUP_PERCENT,
    eurPerUsd: usdToEur(),
    setup: setupCheck(),
  });
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
