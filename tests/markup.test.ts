import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKUP_PERCENT } from "../src/config/pricing";
import { createAccessCode } from "../src/lib/access";
import { summarize } from "../src/lib/admin-summary";
import { toRow } from "../src/lib/admin-codes";
import { hashCode } from "../src/lib/codes";
import { withMarkup } from "../src/lib/cost";
import { MemoryStore } from "../src/lib/store/memory";

let store: MemoryStore;
vi.mock("@/lib/store", () => ({ getStore: () => store }));
const CODE = "ABCD2345EFGH";
const PW = "ein-sehr-langes-passwort-123";
const session = await import("../src/app/api/session/route");
const admin = await import("../src/app/api/admin/codes/[hash]/route");
const login = await import("../src/app/api/admin/login/route");

describe("Aufschlag", () => {
  it("beträgt 10 % auf die echten Kosten und rundet auf ganze Mikro-Cent", () => {
    expect(MARKUP_PERCENT).toBe(10);
    expect(withMarkup(1_000_000)).toBe(1_100_000);
    expect(withMarkup(0)).toBe(0);
    expect(withMarkup(3)).toBe(3); // 3,3 wird 3
    expect(withMarkup(5)).toBe(6); // 5,5 wird 6
    expect(withMarkup(454_545_454)).toBe(499_999_999);
  });
  it("die Summe vieler kleiner Buchungen weicht nur um Rundung ab", () => {
    let summe = 0;
    for (let i = 0; i < 1000; i++) summe += withMarkup(350_000 + i);
    const genau = (350_000 * 1000 + 499_500) * 1.1;
    expect(Math.abs(summe - genau)).toBeLessThan(1000);
  });
});

describe("Buchung im Speicher", () => {
  beforeEach(async () => {
    store = new MemoryStore();
    await createAccessCode(store, "ABCD2345EFGH", "Lisa", 300 * 1_000_000);
  });
  it("speichert echte Kosten und verrechneten Betrag getrennt", async () => {
    const h = hashCode("ABCD2345EFGH");
    await store.addUsage(h, 2_000_000, 1);
    await store.addUsage(h, 1_000_000, 2);
    expect(await store.get(h)).toMatchObject({ costMicro: 3_000_000, chargedMicro: 3_300_000, requests: 2 });
  });
  it("neue Codes starten sichtbar und ohne Verbrauch", async () => {
    expect(await store.get(hashCode("ABCD2345EFGH"))).toMatchObject({ chargedMicro: 0, costMicro: 0, hidden: false });
  });
  it("Ausblenden ändert nur die Sichtbarkeit, nicht den Zugang", async () => {
    const h = hashCode("ABCD2345EFGH");
    await store.update(h, { hidden: true });
    expect(await store.get(h)).toMatchObject({ hidden: true, active: true });
    await store.update(h, { hidden: false });
    expect((await store.get(h))!.hidden).toBe(false);
  });
});

describe("Admin-Zeilen und Summen", () => {
  it("zeigt Verbraucht, Rest, echte Kosten und Gewinn", async () => {
    store = new MemoryStore();
    await createAccessCode(store, "ABCD2345EFGH", "Lisa", 100 * 1_000_000);
    const h = hashCode("ABCD2345EFGH");
    await store.addUsage(h, 20 * 1_000_000, 5); // 20 Cent echt
    const row = toRow(h, (await store.get(h))!);
    expect(row).toMatchObject({ budgetCents: 100, costCents: 20, chargedCents: 22, restCents: 78, profitCents: 2, hidden: false });
  });
  it("summiert über alle Zeilen", () => {
    const s = summarize([
      { budgetCents: 100, chargedCents: 22, costCents: 20, profitCents: 2, restCents: 78, requests: 4, active: true },
      { budgetCents: 300, chargedCents: 330, costCents: 300, profitCents: 30, restCents: -30, requests: 10, active: true },
      { budgetCents: 500, chargedCents: 0, costCents: 0, profitCents: 0, restCents: 500, requests: 0, active: false }, // gesperrt
    ]);
    expect(s).toEqual({ codes: 3, requests: 14, chargedCents: 352, costCents: 320, profitCents: 32, openCents: 78 });
    expect(summarize([])).toEqual({ codes: 0, requests: 0, chargedCents: 0, costCents: 0, profitCents: 0, openCents: 0 });
  });
});

describe("Schüler sehen die echten Kosten nie", () => {
  beforeEach(async () => {
    store = new MemoryStore();
    vi.stubEnv("ADMIN_PASSWORD", PW);
    await createAccessCode(store, CODE, "Lisa", 100 * 1_000_000);
    await store.addUsage(hashCode(CODE), 20 * 1_000_000, 1);
  });

  it("die Anmeldung liefert nur das Restbudget aus dem verrechneten Betrag", async () => {
    const res = await session.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ code: CODE }) }));
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ restCents: 78 }); // 100 - 22, nicht 100 - 20
    expect(text).not.toMatch(/cost|charged|profit|Gewinn/i);
  });
  it("der Admin sieht beide Zahlen und kann ausblenden (nur mit Login)", async () => {
    const hash = hashCode(CODE);
    const ctx = { params: Promise.resolve({ hash }) };
    const patch = (cookie?: string) =>
      admin.PATCH(new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ hidden: true }) }), ctx);
    expect((await patch()).status).toBe(401);
    expect((await store.get(hash))!.hidden).toBe(false);
    const l = await login.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ password: PW }) }));
    const res = await patch(l.headers.get("set-cookie")!.split(";")[0]);
    expect(res.status).toBe(200);
    expect((await res.json()).code).toMatchObject({ hidden: true, costCents: 20, chargedCents: 22, profitCents: 2 });
  });
});
