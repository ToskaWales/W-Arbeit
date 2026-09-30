import { hashCode, normalizeName } from "./codes";
import type { CodeRecord, CodeStore } from "./store/types";

export type AccessResult =
  | { ok: true; hash: string; record: CodeRecord }
  | { ok: false; status: 401 | 402 | 403 | 429; error: string };

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export type LookupResult =
  | { ok: true; hash: string; record: CodeRecord }
  | { ok: false; status: 401 | 403; error: string };

// Nur "gibt es den Code und ist er aktiv?" (für die Anmeldung, ohne Budget und Tageslimit).
export async function lookupCode(store: CodeStore, code: unknown): Promise<LookupResult> {
  if (typeof code !== "string" || code.trim() === "") {
    return { ok: false, status: 401, error: "Bitte gib deinen Zugangscode ein." };
  }
  const hash = hashCode(code);
  const record = await store.get(hash);
  // Gleiche Meldung für "unbekannt" wie für "leer", damit Codes nicht erraten werden können.
  if (!record) return { ok: false, status: 401, error: "Dieser Zugangscode ist ungültig." };
  if (!record.active) return { ok: false, status: 403, error: "Dieser Zugangscode ist gesperrt." };
  return { ok: true, hash, record };
}

// Prüfreihenfolge: Code bekannt und aktiv, Restbudget, Tageslimit.
export async function checkAccess(
  store: CodeStore,
  code: unknown,
  dailyLimit: number,
  now = Date.now(),
): Promise<AccessResult> {
  const found = await lookupCode(store, code);
  if (!found.ok) return found;
  const { hash, record } = found;
  if (record.budgetMicro - record.costMicro <= 0) {
    return { ok: false, status: 402, error: "Dein Budget ist aufgebraucht." };
  }
  const count = await store.incrDaily(hash, dayKey(now));
  if (count > dailyLimit) {
    return { ok: false, status: 429, error: "Tageslimit erreicht. Versuche es morgen wieder." };
  }
  return { ok: true, hash, record };
}

// Einziger Weg, einen Code anzulegen: Name ist Pflicht (wird in M2 von der Admin-API genutzt).
export async function createAccessCode(
  store: CodeStore,
  code: string,
  name: unknown,
  budgetMicro: number,
  now = Date.now(),
) {
  const cleanName = normalizeName(name);
  if (!Number.isFinite(budgetMicro) || budgetMicro < 0) throw new Error("Ungültiges Budget.");
  await store.create(hashCode(code), {
    name: cleanName,
    budgetMicro,
    costMicro: 0,
    requests: 0,
    active: true,
    createdAt: now,
    lastUsedAt: null,
  });
}
