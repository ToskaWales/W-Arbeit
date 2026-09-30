import { beforeEach, describe, expect, it } from "vitest";
import { checkAccess, createAccessCode } from "../src/lib/access";
import { CODE_LENGTH, generateCode, hashCode } from "../src/lib/codes";
import { MemoryStore } from "../src/lib/store/memory";

let store: MemoryStore;
const CODE = "ABCD2345EFGH";

beforeEach(async () => {
  store = new MemoryStore();
  await createAccessCode(store, CODE, "Lisa M.", 500_000_000);
});

describe("Codes", () => {
  it("generiert Codes mit 12 Zeichen, jedes Mal anders", () => {
    const a = generateCode();
    expect(a).toHaveLength(CODE_LENGTH);
    expect(a).not.toBe(generateCode());
  });
  it("hasht mit SHA-256 und ignoriert Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(hashCode(CODE)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode(` ${CODE.toLowerCase()} `)).toBe(hashCode(CODE));
  });
  it("speichert den Klartext-Code nicht", async () => {
    expect(await store.get(CODE)).toBeNull();
    expect(await store.get(hashCode(CODE))).not.toBeNull();
  });
  it("verlangt einen Namen", async () => {
    for (const bad of [undefined, null, "", "   ", 42]) {
      await expect(createAccessCode(store, "XYZ", bad, 100)).rejects.toThrow(/Namen/);
    }
  });
});

describe("Zugangsprüfung", () => {
  it("akzeptiert gültigen Code", async () => {
    const r = await checkAccess(store, CODE, 10);
    expect(r.ok).toBe(true);
  });
  it("lehnt fehlenden, leeren und falschen Code mit 401 ab", async () => {
    for (const bad of [undefined, null, "", "  ", 5, "FALSCH"]) {
      const r = await checkAccess(store, bad, 10);
      expect(r).toMatchObject({ ok: false, status: 401 });
    }
  });
  it("lehnt gesperrten Code mit 403 ab", async () => {
    const h = hashCode(CODE);
    const rec = (await store.get(h))!;
    await store.create(h, { ...rec, active: false });
    expect(await checkAccess(store, CODE, 10)).toMatchObject({ ok: false, status: 403 });
  });
  it("lehnt Code ohne Restbudget mit 402 ab", async () => {
    await store.addUsage(hashCode(CODE), 500_000_000, Date.now());
    expect(await checkAccess(store, CODE, 10)).toMatchObject({ ok: false, status: 402 });
  });
  it("erlaubt Anfrage bei knappem Restbudget (leichtes Überschreiten akzeptiert)", async () => {
    // Das Guthaben sinkt um den verrechneten Betrag (echte Kosten + 10 %), also bleibt bei diesen Kosten noch ein Rest.
    await store.addUsage(hashCode(CODE), 454_545_454, Date.now());
    expect((await store.get(hashCode(CODE)))!.chargedMicro).toBe(499_999_999);
    expect((await checkAccess(store, CODE, 10)).ok).toBe(true);
  });
  it("lehnt nach Erreichen des Tageslimits mit 429 ab, am nächsten Tag geht es wieder", async () => {
    const day1 = Date.parse("2026-09-30T10:00:00Z");
    expect((await checkAccess(store, CODE, 2, day1)).ok).toBe(true);
    expect((await checkAccess(store, CODE, 2, day1)).ok).toBe(true);
    expect(await checkAccess(store, CODE, 2, day1)).toMatchObject({ ok: false, status: 429 });
    expect((await checkAccess(store, CODE, 2, day1 + 24 * 3600 * 1000)).ok).toBe(true);
  });
  it("bucht Nutzung auf den richtigen Code", async () => {
    const h = hashCode(CODE);
    await store.addUsage(h, 1234, 99);
    expect(await store.get(h)).toMatchObject({ costMicro: 1234, requests: 1, lastUsedAt: 99, name: "Lisa M." });
  });
});
