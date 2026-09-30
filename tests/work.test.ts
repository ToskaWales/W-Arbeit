import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessCode } from "../src/lib/access";
import { hashCode } from "../src/lib/codes";
import { decrypt, encrypt, EncryptionConfigError, getEncryptionKey } from "../src/lib/crypto";
import { MemoryStore } from "../src/lib/store/memory";
import { emptyWork, sanitizeWork, safeUrl, WorkError } from "../src/lib/work";
import { deleteWork, loadWork, saveWork, VersionConflict } from "../src/lib/work-store";
import { WORK_LIMITS } from "../src/config/work";

let store: MemoryStore;
vi.mock("@/lib/store", () => ({ getStore: () => store }));
const CODE = "ABCD2345EFGH";
const CODE2 = "ZZZZ2345EFGH";
const PW = "ein-sehr-langes-passwort-123";
const work = await import("../src/app/api/work/route");
const adminWork = await import("../src/app/api/admin/codes/[hash]/work/route");
const login = await import("../src/app/api/admin/login/route");

const KEY = randomBytes(32).toString("base64");
const key = getEncryptionKey(KEY);

describe("Verschlüsselung", () => {
  it("verschlüsselt und entschlüsselt, jedes Mal anders", () => {
    const a = encrypt("Meine Arbeit über Bienen", key, "hash1");
    const b = encrypt("Meine Arbeit über Bienen", key, "hash1");
    expect(a).not.toBe(b);
    expect(a).not.toContain("Bienen");
    expect(decrypt(a, key, "hash1")).toBe("Meine Arbeit über Bienen");
  });
  it("scheitert bei falschem Schlüssel, falschem Besitzer und veränderten Daten", () => {
    const blob = encrypt("geheim", key, "hash1");
    expect(() => decrypt(blob, getEncryptionKey(randomBytes(32).toString("base64")), "hash1")).toThrow();
    expect(() => decrypt(blob, key, "hash2")).toThrow(); // Datensatz eines anderen Codes
    const last = blob.slice(-2);
    expect(() => decrypt(blob.slice(0, -2) + (last === "AA" ? "BB" : "AA"), key, "hash1")).toThrow();
    expect(() => decrypt("v2.abc", key, "hash1")).toThrow();
  });
  it("verlangt einen gültigen Schlüssel", () => {
    expect(() => getEncryptionKey(undefined)).toThrow(EncryptionConfigError);
    expect(() => getEncryptionKey("zukurz")).toThrow(EncryptionConfigError);
  });
});

describe("Prüfung der Arbeit", () => {
  const ok = () => ({
    fach: "Geschichte", thema: "Weimar", zeitraum: "5 Monate", fragestellung: "Warum?", kurzfassung: "", gliederung: "1 A",
    kapitel: [{ id: "k1", titel: "Einleitung", text: "Text" }],
    quellen: [{ id: "q1", titel: "Buch", url: "https://example.org/x", notiz: "", bewertung: "", status: "geprueft" }],
    punkte: [{ id: "p1", text: "Beleg fehlt", herkunft: "kolloquium", erledigt: false }],
    meilensteine: { abschlussCheck: 123, kolloquium: null },
    version: 3,
  });
  it("übernimmt gültige Daten und die Versionsangabe", () => {
    const w = sanitizeWork(ok());
    expect(w.kapitel[0].titel).toBe("Einleitung");
    expect(w.quellen[0].status).toBe("geprueft");
    expect(w.version).toBe(3);
    expect(w.meilensteine).toEqual({ abschlussCheck: 123, kolloquium: null });
  });
  it("ignoriert unbekannte Felder und fehlende Angaben", () => {
    const w = sanitizeWork({ fach: "Bio", hack: "<script>", kapitel: [{ id: "a", titel: "T", text: "x", extra: 1 }] });
    expect(w).not.toHaveProperty("hack");
    expect(w.kapitel[0]).toEqual({ id: "a", titel: "T", text: "x" });
    expect(w.quellen).toEqual([]);
    expect(sanitizeWork({})).toEqual({ ...emptyWork() });
  });
  it("erlaubt nur http(s)-Links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.de", "//evil.de", "https://a b.de", " "]) {
      expect(safeUrl(bad), bad).toBe("");
    }
    expect(safeUrl(" https://example.org/a?b=1 ")).toBe("https://example.org/a?b=1");
    const w = sanitizeWork({ quellen: [{ id: "q", titel: "x", url: "javascript:alert(1)" }] });
    expect(w.quellen[0].url).toBe("");
  });
  it("lehnt falsche Typen, zu lange Felder und zu viele Einträge ab", () => {
    expect(() => sanitizeWork(null)).toThrow(WorkError);
    expect(() => sanitizeWork([])).toThrow(WorkError);
    expect(() => sanitizeWork({ fach: 5 })).toThrow(/Fach/);
    expect(() => sanitizeWork({ fragestellung: "x".repeat(WORK_LIMITS.fragestellung + 1) })).toThrow(/zu lang/);
    expect(() => sanitizeWork({ kapitel: "x" })).toThrow(WorkError);
    expect(() => sanitizeWork({ kapitel: Array.from({ length: WORK_LIMITS.maxKapitel + 1 }, (_, i) => ({ id: `k${i}`, titel: "", text: "" })) })).toThrow(/Zu viele/);
    expect(() => sanitizeWork({ quellen: Array.from({ length: WORK_LIMITS.maxQuellen + 1 }, (_, i) => ({ id: `q${i}` })) })).toThrow(/Zu viele/);
  });
  it("lehnt ungültige und doppelte IDs ab", () => {
    expect(() => sanitizeWork({ kapitel: [{ id: "../x", titel: "", text: "" }] })).toThrow(/ID/);
    expect(() => sanitizeWork({ kapitel: [{ id: "a" }, { id: "a" }] })).toThrow(/Doppelte/);
  });
  it("begrenzt die Gesamtlänge", () => {
    const kapitel = Array.from({ length: 5 }, (_, i) => ({ id: `k${i}`, titel: "", text: "x".repeat(WORK_LIMITS.kapitelText) }));
    expect(() => sanitizeWork({ kapitel })).toThrow(/zu lang/);
  });
  it("entfernt Steuerzeichen, behält Zeilenumbrüche", () => {
    expect(sanitizeWork({ gliederung: "1 A\n2 B\u0000\u0007" }).gliederung).toBe("1 A\n2 B");
  });
});

describe("Speichern und Laden", () => {
  beforeEach(() => (store = new MemoryStore()));

  it("liefert für neue Codes eine leere Arbeit", async () => {
    expect(await loadWork(store, "h1", key)).toEqual(emptyWork());
  });
  it("speichert verschlüsselt, zählt die Version hoch und lädt wieder", async () => {
    const w = sanitizeWork({ fragestellung: "Streng geheime Fragestellung" });
    const s1 = await saveWork(store, "h1", w, 0, key, 1000);
    expect(s1.version).toBe(1);
    expect(s1.updatedAt).toBe(1000);
    const raw = [...store.blobs.values()][0];
    expect(raw).not.toContain("geheime");
    const s2 = await saveWork(store, "h1", { ...s1, fach: "Bio" }, 1, key);
    expect(s2.version).toBe(2);
    expect((await loadWork(store, "h1", key)).fach).toBe("Bio");
  });
  it("überschreibt nichts bei veralteter Version", async () => {
    const s1 = await saveWork(store, "h1", sanitizeWork({ fach: "A" }), 0, key);
    await saveWork(store, "h1", { ...s1, fach: "B" }, 1, key);
    await expect(saveWork(store, "h1", { ...s1, fach: "C" }, 1, key)).rejects.toBeInstanceOf(VersionConflict);
    expect((await loadWork(store, "h1", key)).fach).toBe("B");
  });
  it("trennt Nutzer strikt", async () => {
    await saveWork(store, "h1", sanitizeWork({ fach: "Nur h1" }), 0, key);
    expect((await loadWork(store, "h2", key)).fach).toBe("");
    // Ein untergeschobener Datensatz eines anderen Codes lässt sich nicht lesen
    store.blobs.set("work:h2", store.blobs.get("work:h1")!);
    await expect(loadWork(store, "h2", key)).rejects.toThrow();
  });
  it("löscht", async () => {
    await saveWork(store, "h1", sanitizeWork({ fach: "x" }), 0, key);
    await deleteWork(store, "h1");
    expect(await loadWork(store, "h1", key)).toEqual(emptyWork());
  });
});

describe("/api/work und Admin-Löschung", () => {

  const req = (method: string, code: string | null, body?: unknown, extra: Record<string, string> = {}) =>
    new Request("http://x/api/work", {
      method,
      headers: { ...(code ? { "x-access-code": code } : {}), "Content-Type": "application/json", ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  beforeEach(async () => {
    store = new MemoryStore();
    vi.stubEnv("WORK_ENCRYPTION_KEY", KEY);
    vi.stubEnv("ADMIN_PASSWORD", PW);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await createAccessCode(store, CODE, "Lisa", 100_000_000);
    await createAccessCode(store, CODE2, "Max", 100_000_000);
  });

  it("verlangt einen gültigen Code (401), sperrt gesperrte Codes (403)", async () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const handler = (work as Record<string, (r: Request) => Promise<Response>>)[method];
      const body = method === "PUT" ? { work: {} } : undefined;
      expect((await handler(req(method, null, body))).status).toBe(401);
      expect((await handler(req(method, "FALSCH", body))).status).toBe(401);
    }
    await store.update(hashCode(CODE), { active: false });
    expect((await work.GET(req("GET", CODE))).status).toBe(403);
  });
  it("leere Arbeit, speichern, laden", async () => {
    let res = await work.GET(req("GET", CODE));
    expect((await res.json()).work.version).toBe(0);
    res = await work.PUT(req("PUT", CODE, { work: { fach: "Geschichte", fragestellung: "Warum?", version: 0 } }));
    expect(res.status).toBe(200);
    expect((await res.json()).work.version).toBe(1);
    res = await work.GET(req("GET", CODE));
    const w = (await res.json()).work;
    expect(w).toMatchObject({ fach: "Geschichte", fragestellung: "Warum?", version: 1 });
    expect([...store.blobs.values()].join()).not.toContain("Warum?");
  });
  it("Nutzer sehen nur ihre eigene Arbeit", async () => {
    await work.PUT(req("PUT", CODE, { work: { fach: "Nur Lisa", version: 0 } }));
    const other = await (await work.GET(req("GET", CODE2))).json();
    expect(other.work.fach).toBe("");
  });
  it("meldet Versionskonflikte mit der neuesten Fassung (409)", async () => {
    await work.PUT(req("PUT", CODE, { work: { fach: "v1", version: 0 } }));
    const res = await work.PUT(req("PUT", CODE, { work: { fach: "alt", version: 0 } }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.work.fach).toBe("v1");
    expect(body.error).toContain("anderen Fenster");
  });
  it("lehnt ungültige Daten (400), kaputtes JSON und zu große Anfragen (413) ab", async () => {
    expect((await work.PUT(req("PUT", CODE, { work: { fach: 5 } }))).status).toBe(400);
    expect((await work.PUT(req("PUT", CODE, { work: null }))).status).toBe(400);
    expect((await work.PUT(new Request("http://x", { method: "PUT", headers: { "x-access-code": CODE }, body: "{kaputt" }))).status).toBe(400);
    expect((await work.PUT(req("PUT", CODE, { work: {} }, { "content-length": String(700 * 1024) }))).status).toBe(413);
  });
  it("bremst zu viele Schreibvorgänge (429)", async () => {
    let last = 200;
    for (let i = 0; i < 302 && last !== 429; i++) last = (await work.PUT(req("PUT", CODE, { work: { version: i } }))).status;
    expect(last).toBe(429);
  });
  it("Löschen entfernt die Arbeit", async () => {
    await work.PUT(req("PUT", CODE, { work: { fach: "weg", version: 0 } }));
    expect((await work.DELETE(req("DELETE", CODE))).status).toBe(200);
    expect((await (await work.GET(req("GET", CODE))).json()).work.fach).toBe("");
    expect(store.blobs.size).toBe(0);
  });
  it("ist gesperrt (503), solange der Schlüssel fehlt, und Daten gehen nicht unverschlüsselt raus", async () => {
    vi.stubEnv("WORK_ENCRYPTION_KEY", "");
    const res = await work.PUT(req("PUT", CODE, { work: { fach: "x", version: 0 } }));
    expect(res.status).toBe(503);
    expect(store.blobs.size).toBe(0);
  });
  it("Admin kann nur mit Login die Arbeit eines Codes löschen, der Code bleibt", async () => {
    await work.PUT(req("PUT", CODE, { work: { fach: "x", version: 0 } }));
    const hash = hashCode(CODE);
    const ctx = { params: Promise.resolve({ hash }) };
    const noLogin = await adminWork.DELETE(new Request("http://x", { method: "DELETE" }), ctx);
    expect(noLogin.status).toBe(401);
    expect(store.blobs.size).toBe(1);
    const l = await login.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ password: PW }) }));
    const cookie = l.headers.get("set-cookie")!.split(";")[0];
    const ok = await adminWork.DELETE(new Request("http://x", { method: "DELETE", headers: { cookie } }), ctx);
    expect(ok.status).toBe(200);
    expect(store.blobs.size).toBe(0);
    expect(await store.get(hash)).not.toBeNull();
    const nf = await adminWork.DELETE(new Request("http://x", { method: "DELETE", headers: { cookie } }), { params: Promise.resolve({ hash: "unbekannt" }) });
    expect(nf.status).toBe(404);
  });
});
