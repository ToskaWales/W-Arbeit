import { createAccessCode } from "./access";
import { generateCode, hashCode, normalizeName } from "./codes";
import { MICRO_PER_CENT, microToCents } from "./cost";
import type { CodeRecord, CodeStore } from "./store/types";

export const MAX_BUDGET_CENTS = 100_000; // 1.000 $ pro Aufladung/Code als Schutz vor Tippfehlern

function centsToMicro(cents: unknown): number {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0 || cents > MAX_BUDGET_CENTS) {
    throw new Error(`Budget muss zwischen 0 und ${MAX_BUDGET_CENTS} Cent liegen.`);
  }
  return Math.round(cents * MICRO_PER_CENT);
}

// Erzeugt einen neuen Code für einen Namen. Der Klartext-Code wird nur hier zurückgegeben.
export async function createCodeForName(store: CodeStore, name: unknown, cents: unknown) {
  const cleanName = normalizeName(name);
  const budgetMicro = centsToMicro(cents);
  const code = generateCode();
  await createAccessCode(store, code, cleanName, budgetMicro);
  return { code, hash: hashCode(code), name: cleanName };
}

export async function addBudget(store: CodeStore, hash: string, cents: unknown) {
  return store.update(hash, { addBudgetMicro: centsToMicro(cents) });
}

export async function setActive(store: CodeStore, hash: string, active: unknown) {
  if (typeof active !== "boolean") throw new Error("active muss true oder false sein.");
  return store.update(hash, { active });
}

export async function setHidden(store: CodeStore, hash: string, hidden: unknown) {
  if (typeof hidden !== "boolean") throw new Error("hidden muss true oder false sein.");
  return store.update(hash, { hidden });
}

// Umbenennen ja, leeren Namen nie.
export async function renameCode(store: CodeStore, hash: string, name: unknown) {
  return store.update(hash, { name: normalizeName(name) });
}

export function toRow(hash: string, r: CodeRecord) {
  return {
    id: hash,
    name: r.name,
    budgetCents: microToCents(r.budgetMicro),
    chargedCents: microToCents(r.chargedMicro), // verrechnet: das sieht auch der Schüler
    restCents: microToCents(r.budgetMicro - r.chargedMicro),
    costCents: microToCents(r.costMicro), // echte API-Kosten, nur im Admin
    profitCents: microToCents(r.chargedMicro - r.costMicro),
    requests: r.requests,
    active: r.active,
    hidden: r.hidden,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
  };
}
