import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USD_EUR_DEFAULT, usdToEur } from "../src/config/pricing";
import { createAccessCode } from "../src/lib/access";
import { toRow } from "../src/lib/admin-codes";
import { hashCode } from "../src/lib/codes";
import { chargedFromCost } from "../src/lib/cost";
import { euroToCents, formatEuro } from "../src/lib/money";
import { MemoryStore } from "../src/lib/store/memory";

let store: MemoryStore;
vi.mock("@/lib/store", () => ({ getStore: () => store }));
const PW = "ein-sehr-langes-passwort-123";
const codes = await import("../src/app/api/admin/codes/route");
const login = await import("../src/app/api/admin/login/route");
const work = await import("../src/app/api/work/route");
const session = await import("../src/app/api/session/route");

describe("Wechselkurs", () => {
  it("Standard ist der EZB-Referenzkurs, per Umgebungsvariable änderbar, Unsinn wird ignoriert", () => {
    expect(USD_EUR_DEFAULT).toBeCloseTo(1 / 1.1355, 3);
    expect(usdToEur({})).toBe(USD_EUR_DEFAULT);
    expect(usdToEur({ USD_EUR_RATE: "0.9" })).toBe(0.9);
    for (const bad of ["abc", "0", "-1", "50", ""]) expect(usdToEur({ USD_EUR_RATE: bad })).toBe(USD_EUR_DEFAULT);
  });
  it("verrechnet in Euro: echte Dollar-Kosten × Kurs, dann 10 % Aufschlag", () => {
    expect(chargedFromCost(1_000_000, 0.8807)).toBe(968_770);
    expect(chargedFromCost(1_000_000, 1)).toBe(1_100_000);
    expect(chargedFromCost(0, 0.88)).toBe(0);
  });
});

describe("Buchung mit Kurs", () => {
  beforeEach(async () => {
    store = new MemoryStore();
    vi.stubEnv("USD_EUR_RATE", "0.9");
    await createAccessCode(store, "ABCD2345EFGH", "Lisa", 500 * 1_000_000); // 5 Euro
  });
  it("Guthaben und verrechneter Betrag sind Euro, die echten Kosten bleiben Dollar", async () => {
    const h = hashCode("ABCD2345EFGH");
    await store.addUsage(h, 1_000_000, 1); // 1 Cent (Dollar) echte Kosten
    expect(await store.get(h)).toMatchObject({ costMicro: 1_000_000, chargedMicro: 990_000 }); // 1 × 0,9 × 1,1
  });
  it("ein späterer Kurswechsel ändert bereits gebuchte Beträge nicht", async () => {
    const h = hashCode("ABCD2345EFGH");
    await store.addUsage(h, 1_000_000, 1);
    vi.stubEnv("USD_EUR_RATE", "0.5");
    expect((await store.get(h))!.chargedMicro).toBe(990_000);
    await store.addUsage(h, 1_000_000, 2);
    expect((await store.get(h))!.chargedMicro).toBe(990_000 + 550_000);
  });
  it("Admin-Zeile: echte Kosten in Euro, Gewinn = verrechnet minus echte Kosten in Euro", async () => {
    const h = hashCode("ABCD2345EFGH");
    await store.addUsage(h, 20 * 1_000_000, 5); // 20 Cent Dollar
    const row = toRow(h, (await store.get(h))!, 0.9);
    expect(row.costUsdCents).toBeCloseTo(20, 6);
    expect(row.costCents).toBeCloseTo(18, 6); // 20 × 0,9
    expect(row.chargedCents).toBeCloseTo(19.8, 6); // 18 × 1,1
    expect(row.profitCents).toBeCloseTo(1.8, 6); // genau 10 % der echten Kosten in Euro
    expect(row.budgetCents).toBe(500);
    expect(row.restCents).toBeCloseTo(480.2, 6);
  });
  it("der Schüler sieht sein Restbudget in Euro und sonst nichts", async () => {
    const h = hashCode("ABCD2345EFGH");
    await store.addUsage(h, 100 * 1_000_000, 1);
    const res = await session.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ code: "ABCD2345EFGH" }) }));
    const text = await res.text();
    expect(JSON.parse(text).restCents).toBeCloseTo(500 - 99, 6); // 100 × 0,9 × 1,1 = 99 Euro-Cent verrechnet
    expect(text).not.toMatch(/cost|Usd|profit|rate|kurs/i);
  });
});

describe("Darstellung in Euro", () => {
  it("formatiert Cent als Euro, kleine Beträge genauer", () => {
    expect(formatEuro(123.244)).toBe("1,23 €");
    expect(formatEuro(500)).toBe("5,00 €");
    expect(formatEuro(0.9)).toBe("0,009 €");
    expect(formatEuro(98.7676)).toBe("0,988 €");
    expect(formatEuro(0)).toBe("0,000 €");
  });
  it("liest Eingaben in Euro", () => {
    expect(euroToCents("5")).toBe(500);
    expect(euroToCents("7,50")).toBe(750);
    expect(euroToCents(" 7.5 ")).toBe(750);
    expect(euroToCents("0,05")).toBe(5);
    for (const bad of ["", "abc", "-5", "0", "1,234", "5 €", "1e3"]) expect(euroToCents(bad), bad).toBeNull();
  });
});

describe("Admin sieht Kurs und Einrichtungsprobleme", () => {
  const key = randomBytes(32).toString("base64");
  const cookie = async () => {
    vi.stubEnv("ADMIN_PASSWORD", PW);
    const l = await login.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ password: PW }) }));
    return l.headers.get("set-cookie")!.split(";")[0];
  };
  const list = async (c: string) => (await codes.GET(new Request("http://x", { headers: { cookie: c } }))).json();
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("meldet einen fehlenden Speicherschlüssel und sagt, was zu tun ist", async () => {
    vi.stubEnv("WORK_ENCRYPTION_KEY", "");
    const body = await list(await cookie());
    expect(body.setup.problems).toHaveLength(1);
    expect(body.setup.problems[0]).toContain("WORK_ENCRYPTION_KEY");
    expect(body.setup.problems[0]).toContain("npm run key");
  });
  it("meldet nichts, wenn alles eingerichtet ist, und liefert den Kurs", async () => {
    vi.stubEnv("WORK_ENCRYPTION_KEY", key);
    vi.stubEnv("USD_EUR_RATE", "0.9");
    const body = await list(await cookie());
    expect(body.setup.problems).toEqual([]);
    expect(body.eurPerUsd).toBe(0.9);
  });
  it("ohne Login weder Kurs noch Einrichtungsstand", async () => {
    const res = await codes.GET(new Request("http://x"));
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toMatch(/WORK_ENCRYPTION|eurPerUsd|problems/);
  });
  it("Schüler bekommen bei fehlendem Schlüssel eine verständliche Meldung ohne Technik", async () => {
    vi.stubEnv("WORK_ENCRYPTION_KEY", "");
    await createAccessCode(store, "ABCD2345EFGH", "Lisa", 1e8);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await work.GET(new Request("http://x", { headers: { "x-access-code": "ABCD2345EFGH" } }));
    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error).toContain("gerade nicht verfügbar");
    expect(error).toContain("Betreiber");
    expect(error).not.toMatch(/ENCRYPTION|KEY|Umgebungsvariable/i);
  });
});
