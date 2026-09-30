import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessCode } from "../src/lib/access";
import { hashCode } from "../src/lib/codes";
import { MemoryStore } from "../src/lib/store/memory";

let store: MemoryStore;
vi.mock("@/lib/store", () => ({ getStore: () => store }));
const { POST } = await import("../src/app/api/session/route");
const call = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
const CODE = "ABCD2345EFGH";

beforeEach(async () => {
  store = new MemoryStore();
  await createAccessCode(store, CODE, "Lisa", 200 * 1_000_000);
});

describe("/api/session", () => {
  it("liefert das Restbudget", async () => {
    await store.addUsage(hashCode(CODE), 50 * 1_000_000, 1);
    const res = await call({ code: CODE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ restCents: 150 });
  });
  it("zeigt bei leerem Budget 0 an, lässt aber die Anmeldung zu", async () => {
    await store.addUsage(hashCode(CODE), 250 * 1_000_000, 1);
    expect(await (await call({ code: CODE })).json()).toEqual({ restCents: 0 });
  });
  it("lehnt leeren, falschen und gesperrten Code ab, gibt nichts über den Datensatz preis", async () => {
    expect((await call({ code: "" })).status).toBe(401);
    expect((await call({})).status).toBe(401);
    expect((await call({ code: "FALSCH" })).status).toBe(401);
    await store.update(hashCode(CODE), { active: false });
    const res = await call({ code: CODE });
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("Lisa");
  });
  it("zählt nicht zum Tageslimit", async () => {
    await call({ code: CODE });
    expect(await store.incrDaily(hashCode(CODE), new Date().toISOString().slice(0, 10))).toBe(1);
  });
  it("bremst das Raten von Codes (429) und meldet Speicher-Ausfall sauber", async () => {
    const withIp = (code: string) =>
      POST(new Request("http://x", { method: "POST", headers: { "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ code }) }));
    for (let i = 0; i < 20; i++) expect((await withIp(`RATEN${i}`)).status).toBe(401);
    expect((await withIp(CODE)).status).toBe(429);
    store.get = async () => {
      throw new Error("Redis down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call({ code: CODE })).status).toBe(500);
  });
});
