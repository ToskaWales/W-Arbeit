import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAccess } from "../src/lib/access";
import { hashCode } from "../src/lib/codes";
import { MemoryStore } from "../src/lib/store/memory";

const PW = "ein-sehr-langes-passwort-123";
let store: MemoryStore;
vi.mock("@/lib/store", () => ({ getStore: () => store }));

const login = await import("../src/app/api/admin/login/route");
const codes = await import("../src/app/api/admin/codes/route");
const one = await import("../src/app/api/admin/codes/[hash]/route");

const req = (method: string, body?: unknown, cookie?: string) =>
  new Request("http://x/api/admin", {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (hash: string) => ({ params: Promise.resolve({ hash }) });

async function adminCookie() {
  const res = await login.POST(req("POST", { password: PW }));
  expect(res.status).toBe(200);
  const set = res.headers.get("set-cookie")!;
  expect(set).toContain("HttpOnly");
  expect(set).toContain("SameSite=Strict");
  return set.split(";")[0];
}

beforeEach(() => {
  store = new MemoryStore();
  vi.stubEnv("ADMIN_PASSWORD", PW);
});

describe("Admin-Endpunkte ohne Login", () => {
  const bad = ["", "admin_session=quatsch", "admin_session=9999999999.abc"];
  it.each(bad)("lehnen alle mit 401 ab (Cookie: %j)", async (cookie) => {
    const c = cookie || undefined;
    expect((await codes.GET(req("GET", undefined, c))).status).toBe(401);
    expect((await codes.POST(req("POST", { name: "Lisa", budgetCents: 100 }, c))).status).toBe(401);
    expect((await one.PATCH(req("PATCH", { active: false }, c), ctx("x"))).status).toBe(401);
    expect(await store.list()).toHaveLength(0); // es wurde nichts angelegt
  });
  it("sind gesperrt, wenn kein Admin-Passwort gesetzt ist", async () => {
    const cookie = await adminCookie();
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect((await codes.GET(req("GET", undefined, cookie))).status).toBe(401);
    expect((await login.POST(req("POST", { password: "" }))).status).toBe(503);
  });
});

describe("Login", () => {
  it("lehnt falsches Passwort ab und setzt kein Cookie", async () => {
    const res = await login.POST(req("POST", { password: "falsch" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("sperrt nach zu vielen Versuchen (429)", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await login.POST(req("POST", { password: "falsch" }))).status;
    expect(last).toBe(429);
  });
});

describe("Admin-Endpunkte mit Login", () => {
  it("lehnt Code ohne Namen ab", async () => {
    const cookie = await adminCookie();
    for (const name of [undefined, null, "", "   ", 5]) {
      const res = await codes.POST(req("POST", { name, budgetCents: 100 }, cookie));
      expect(res.status).toBe(400);
    }
    expect(await store.list()).toHaveLength(0);
  });
  it("lehnt ungültiges Budget ab", async () => {
    const cookie = await adminCookie();
    for (const budgetCents of [undefined, -5, 0, "abc", 1e9]) {
      expect((await codes.POST(req("POST", { name: "Lisa", budgetCents }, cookie))).status).toBe(400);
    }
  });
  it("erstellt Code für Namen, der danach funktioniert; speichert nur den Hash", async () => {
    const cookie = await adminCookie();
    const res = await codes.POST(req("POST", { name: "  Lisa M. ", budgetCents: 250 }, cookie));
    expect(res.status).toBe(201);
    const { code, name } = await res.json();
    expect(name).toBe("Lisa M.");
    expect(code).toHaveLength(12);
    expect((await checkAccess(store, code, 10)).ok).toBe(true);
    const list = await (await codes.GET(req("GET", undefined, cookie))).json();
    expect(list.codes).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(code);
    expect(list.codes[0]).toMatchObject({ name: "Lisa M.", budgetCents: 250, costCents: 0, active: true });
  });
  it("liefert den Aufschlag nur nach dem Login mit der Liste", async () => {
    const cookie = await adminCookie();
    const body = await (await codes.GET(req("GET", undefined, cookie))).json();
    expect(body.markupPercent).toBe(10);
    const ohne = await codes.GET(req("GET"));
    expect(ohne.status).toBe(401);
    expect(JSON.stringify(await ohne.json())).not.toMatch(/markup|10/);
  });
  it("zeigt Kosten beim richtigen Namen", async () => {
    const cookie = await adminCookie();
    const a = await (await codes.POST(req("POST", { name: "Lisa", budgetCents: 100 }, cookie))).json();
    const b = await (await codes.POST(req("POST", { name: "Max", budgetCents: 100 }, cookie))).json();
    await store.addUsage(hashCode(b.code), 350_000, Date.now());
    const { codes: rows } = await (await codes.GET(req("GET", undefined, cookie))).json();
    expect(rows.find((r: { name: string }) => r.name === "Max")).toMatchObject({ costCents: 0.35, requests: 1 });
    expect(rows.find((r: { name: string }) => r.name === "Lisa")).toMatchObject({ costCents: 0, requests: 0 });
    expect(a.code).not.toBe(b.code);
  });
  it("lädt Budget auf, sperrt und entsperrt", async () => {
    const cookie = await adminCookie();
    const { code } = await (await codes.POST(req("POST", { name: "Lisa", budgetCents: 100 }, cookie))).json();
    const h = hashCode(code);
    let res = await one.PATCH(req("PATCH", { addCents: 50 }, cookie), ctx(h));
    expect((await res.json()).code.budgetCents).toBe(150);
    res = await one.PATCH(req("PATCH", { active: false }, cookie), ctx(h));
    expect((await res.json()).code.active).toBe(false);
    expect(await checkAccess(store, code, 10)).toMatchObject({ ok: false, status: 403 });
    await one.PATCH(req("PATCH", { active: true }, cookie), ctx(h));
    expect((await checkAccess(store, code, 10)).ok).toBe(true);
  });
  it("erlaubt Umbenennen, aber nie einen leeren Namen", async () => {
    const cookie = await adminCookie();
    const { code } = await (await codes.POST(req("POST", { name: "Lisa", budgetCents: 100 }, cookie))).json();
    const h = hashCode(code);
    expect((await one.PATCH(req("PATCH", { name: "" }, cookie), ctx(h))).status).toBe(400);
    expect((await one.PATCH(req("PATCH", { name: "   " }, cookie), ctx(h))).status).toBe(400);
    const res = await one.PATCH(req("PATCH", { name: "Lisa Meier" }, cookie), ctx(h));
    expect((await res.json()).code.name).toBe("Lisa Meier");
  });
  it("lehnt ungültige Aufladung ab und meldet unbekannten Code mit 404", async () => {
    const cookie = await adminCookie();
    const { code } = await (await codes.POST(req("POST", { name: "Lisa", budgetCents: 100 }, cookie))).json();
    expect((await one.PATCH(req("PATCH", { addCents: -10 }, cookie), ctx(hashCode(code)))).status).toBe(400);
    expect((await one.PATCH(req("PATCH", { addCents: 10 }, cookie), ctx("unbekannt"))).status).toBe(404);
  });
});
