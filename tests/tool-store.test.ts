import { beforeEach, describe, expect, it, vi } from "vitest";

// sessionStorage gibt es in der Testumgebung nicht: einfache Nachbildung
class FakeStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  clear() { this.data.clear(); }
}
// Object.keys(sessionStorage) muss die Schlüssel liefern, wie im Browser
const makeStorage = () => {
  const s = new FakeStorage();
  return new Proxy(s, { ownKeys: () => [...s.data.keys()], getOwnPropertyDescriptor: (t, k) => (t.data.has(String(k)) ? { enumerable: true, configurable: true, value: t.data.get(String(k)) } : Object.getOwnPropertyDescriptor(t, k)) });
};

let store: typeof import("../src/lib/tool-store");
let storage: ReturnType<typeof makeStorage>;

beforeEach(async () => {
  vi.resetModules();
  storage = makeStorage();
  vi.stubGlobal("sessionStorage", storage);
  store = await import("../src/lib/tool-store");
});

const done = (answer: string, sig = "s") => ({ phase: "done" as const, answer, error: "", treffer: [], sig });

describe("Stand der Tools", () => {
  it("behält fertige Ergebnisse und lädt sie nach einem Neuladen aus der Sitzung", async () => {
    store.setStream("fragestellung:sparring", done("Ergebnis"));
    expect(store.getStream("fragestellung:sparring").answer).toBe("Ergebnis");
    vi.resetModules(); // wie ein Neuladen der Seite: Arbeitsspeicher weg, Sitzung noch da
    const neu = await import("../src/lib/tool-store");
    expect(neu.getStream("fragestellung:sparring")).toMatchObject({ phase: "done", answer: "Ergebnis" });
  });
  it("hält jeden Modus und jedes Tool getrennt", () => {
    store.setStream("a:sparring", done("A"));
    store.setStream("a:schreiben", done("B"));
    expect(store.getStream("a:sparring").answer).toBe("A");
    expect(store.getStream("a:schreiben").answer).toBe("B");
    expect(store.getStream("b:sparring")).toEqual(store.IDLE);
  });
  it("erkennt laufende Abrufe (Schutz vor doppeltem Start) und merkt sie nicht dauerhaft", async () => {
    store.setStream("x:sparring", { ...store.IDLE, phase: "waiting" });
    expect(store.isRunning("x:sparring")).toBe(true);
    store.setStream("x:sparring", { ...store.IDLE, phase: "streaming", answer: "halb" });
    expect(store.isRunning("x:sparring")).toBe(true);
    vi.resetModules();
    const neu = await import("../src/lib/tool-store");
    expect(neu.isRunning("x:sparring")).toBe(false); // nach Neuladen ist nichts mehr in Arbeit
    expect(neu.getStream("x:sparring")).toEqual(neu.IDLE);
  });
  it("speichert Fehler nicht dauerhaft", async () => {
    store.setStream("x:sparring", { ...store.IDLE, phase: "error", error: "Kaputt" });
    vi.resetModules();
    expect((await import("../src/lib/tool-store")).getStream("x:sparring").phase).toBe("idle");
  });
  it("informiert Zuhörer bei Änderungen", () => {
    const cb = vi.fn();
    const off = store.subscribe(cb);
    store.setStream("k", done("x"));
    store.setValue("v", 1);
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    store.setValue("v", 2);
    expect(cb).toHaveBeenCalledTimes(2);
  });
  it("liefert stabile Werte (gleiche Referenz), sonst gäbe es Endlosschleifen in React", () => {
    const fb = { a: 1 };
    expect(store.getValue("f", fb)).toBe(fb);
    store.setValue("f", { a: 2 });
    expect(store.getValue("f", fb)).toBe(store.getValue("f", fb));
    expect(store.getStream("z")).toBe(store.getStream("z"));
  });
  it("merkt Eingaben und liest sie nach dem Neuladen wieder", async () => {
    store.setValue("kolloquium", { turns: [1, 2] });
    vi.resetModules();
    expect((await import("../src/lib/tool-store")).getValue("kolloquium", null)).toEqual({ turns: [1, 2] });
  });
  it("vergisst beim Abmelden alles, auch in der Sitzung", () => {
    store.setStream("a:sparring", done("geheim"));
    store.setValue("form", { text: "privat" });
    store.clearToolState();
    expect(store.getStream("a:sparring")).toEqual(store.IDLE);
    expect(store.getValue("form", "leer")).toBe("leer");
    expect([...storage.data.keys()].filter((k: string) => k.startsWith("wsh:"))).toEqual([]);
  });
  it("kommt auch ohne Speicher im Browser klar (nur Arbeitsspeicher)", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    vi.resetModules();
    const s = await import("../src/lib/tool-store");
    s.setStream("a", done("x"));
    expect(s.getStream("a").answer).toBe("x");
    s.setValue("v", 1);
    expect(s.getValue("v", 0)).toBe(1);
  });
});

describe("Fingerabdruck einer Anfrage", () => {
  it("gleiche Eingabe gibt denselben Wert, jede Änderung einen anderen", () => {
    const a = store.signature({ json: { tool: "t", fields: { x: "1" } } }, "sparring");
    expect(store.signature({ json: { tool: "t", fields: { x: "1" } } }, "sparring")).toBe(a);
    expect(store.signature({ json: { tool: "t", fields: { x: "2" } } }, "sparring")).not.toBe(a);
    expect(store.signature({ json: { tool: "t", fields: { x: "1" } } }, "schreiben")).not.toBe(a);
  });
  it("unterscheidet hochgeladene Dateien", () => {
    const mk = (name: string, size: number) => {
      const f = new FormData();
      f.set("tool", "quellenkritik");
      f.set("file", new File(["x".repeat(size)], name, { lastModified: 1000 }));
      return f;
    };
    expect(store.signature({ form: mk("a.pdf", 5) }, "sparring")).toBe(store.signature({ form: mk("a.pdf", 5) }, "sparring"));
    expect(store.signature({ form: mk("a.pdf", 5) }, "sparring")).not.toBe(store.signature({ form: mk("b.pdf", 5) }, "sparring"));
    expect(store.signature({ form: mk("a.pdf", 5) }, "sparring")).not.toBe(store.signature({ form: mk("a.pdf", 6) }, "sparring"));
  });
});
