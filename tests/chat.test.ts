import { describe, expect, it } from "vitest";
import { CHAT } from "../src/config/tools";
import { lastErgebnis, splitErgebnis } from "../src/lib/chat";
import { prepareRequest } from "../src/lib/prepare";
import { emptyWork } from "../src/lib/work";
import { makePdf } from "./helpers";

const FRAGE = { fach: "Geschichte", thema: "Weimar", fragestellung: "Warum scheiterte Weimar?", zeitraum: "5 Monate" };
const turns = (n: number) => Array.from({ length: n }, (_, i) => [{ role: "assistant", content: `KI ${i}` }, { role: "user", content: `Ich ${i}` }]).flat();

describe("Ergebnis-Block", () => {
  it("trennt Text und Ergebnis", () => {
    const r = splitErgebnis("Gut.\n[ERGEBNIS]\nWarum?\n[/ERGEBNIS]\nBestätigen?");
    expect(r.ergebnis).toBe("Warum?");
    expect(r.text).toBe("Gut.\n\nBestätigen?");
    expect(r.offen).toBe(false);
  });
  it("erkennt einen noch laufenden Block", () => {
    expect(splitErgebnis("Gut.\n[ERGEBNIS]\nWar")).toMatchObject({ text: "Gut.", ergebnis: "War", offen: true });
  });
  it("ohne Block bleibt der Text", () => {
    expect(splitErgebnis("Nur Text")).toEqual({ text: "Nur Text", ergebnis: null, offen: false });
  });
  it("nimmt das jüngste Ergebnis", () => {
    const t = [
      { role: "assistant" as const, content: "A\n[ERGEBNIS]\neins\n[/ERGEBNIS]" },
      { role: "user" as const, content: "ändere" },
      { role: "assistant" as const, content: "B\n[ERGEBNIS]\nzwei\n[/ERGEBNIS]" },
      { role: "user" as const, content: "danke" },
    ];
    expect(lastErgebnis(t)).toBe("zwei");
    expect(lastErgebnis(t.slice(0, 2))).toBe("eins");
    expect(lastErgebnis([])).toBeNull();
  });
});

describe("Gespräch in den Tools (Server)", () => {
  it("ohne Verlauf bleibt alles wie bisher", async () => {
    const r = await prepareRequest("fragestellung", { fields: FRAGE });
    expect(r.messages).toHaveLength(1);
    expect(r.system).not.toContain("[ERGEBNIS]");
  });

  it("hängt den Verlauf an und ergänzt den Gesprächs-Prompt", async () => {
    const r = await prepareRequest("fragestellung", { fields: FRAGE, history: turns(1) });
    expect(r.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(String(r.messages[2].content)).toContain("<nutzereingabe>");
    expect(r.system).toContain("[ERGEBNIS]");
    expect(r.system).toContain("selbst geschrieben"); // Sparring: nur eigene Formulierung des Schülers
    expect(r.minBudgetMicro).toBe(CHAT.followMinBudgetCents * 1_000_000);
  });

  it("im Schreibmodus darf die KI die Fragestellung formulieren", async () => {
    const r = await prepareRequest("fragestellung", { mode: "schreiben", fields: FRAGE, history: turns(1) });
    expect(r.system).toContain("Deine beste Fragestellung");
  });

  it("lehnt kaputte Verläufe ab", async () => {
    await expect(prepareRequest("fragestellung", { fields: FRAGE, history: [{ role: "assistant", content: "x" }] })).rejects.toThrow(/beantworte/);
    await expect(prepareRequest("fragestellung", { fields: FRAGE, history: [{ role: "user", content: "x" }] })).rejects.toThrow(/Ungültig/);
    await expect(prepareRequest("fragestellung", { fields: FRAGE, history: "x" })).rejects.toThrow(/Ungültig/);
    await expect(prepareRequest("fragestellung", { fields: FRAGE, history: [{ role: "assistant", content: "a" }, { role: "user", content: "  " }] })).rejects.toThrow(/Antwort/);
  });

  it("begrenzt die Länge des Gesprächs", async () => {
    await expect(prepareRequest("fragestellung", { fields: FRAGE, history: turns(CHAT.maxUserTurns) })).resolves.toBeDefined();
    await expect(prepareRequest("fragestellung", { fields: FRAGE, history: turns(CHAT.maxUserTurns + 1) })).rejects.toThrow(/zu lang/);
  });

  it("verlangt in der letzten Runde das Ergebnis", async () => {
    const r = await prepareRequest("fragestellung", { fields: FRAGE, history: turns(CHAT.maxUserTurns) });
    expect(r.system).toContain("letzte Runde");
    const early = await prepareRequest("fragestellung", { fields: FRAGE, history: turns(2) });
    expect(early.system).not.toContain("letzte Runde");
  });

  it("Quellensuche hat keinen Verlauf", async () => {
    await expect(prepareRequest("quellensuche", { fields: { suchauftrag: "Belege" }, history: turns(1) })).rejects.toThrow(/keinen Gesprächsverlauf/);
  });

  it("Roter Faden und Schreibassistent führen das Gespräch ebenfalls", async () => {
    const rf = await prepareRequest("roter-faden", { fields: { fragestellung: "Warum?", gliederung: "1. A\n2. B" }, history: turns(1) });
    expect(rf.system).toContain("Gliederung des Schülers");
    const sa = await prepareRequest("schreibassistent", { mode: "schreiben", fields: { aufgabe: "Einleitung", laenge: "kurz", inhalt: "- a" }, history: turns(1) });
    expect(sa.system).toContain("Entwurf");
    expect(sa.messages).toHaveLength(3);
  });

  it("Quellenkritik: Folgerunde braucht kein PDF und keinen Text mehr", async () => {
    const r = await prepareRequest("quellenkritik", { fields: { verwendung: "Kapitel 3", text: "" }, history: turns(1) });
    expect(String(r.messages[0].content)).toContain("nicht mehr vor");
    expect(r.minBudgetMicro).toBe(3_000_000); // kein PDF-Mindestbudget
    await expect(prepareRequest("quellenkritik", { fields: { verwendung: "Kapitel 3", text: "" } })).rejects.toThrow(/PDF hoch/);
    // Ein PDF in der Erstanfrage bleibt wie gehabt
    const file = new File([await makePdf(2)], "q.pdf");
    const first = await prepareRequest("quellenkritik", { fields: { verwendung: "x" }, file });
    expect(first.minBudgetMicro).toBe(25_000_000);
  });

  it("Abschluss: Folgerunde schickt die ganze Arbeit nicht noch einmal", async () => {
    const work = { ...emptyWork(), fragestellung: "Warum?", kapitel: [{ id: "k1", titel: "Einleitung", text: "GEHEIMER-KAPITELTEXT ".repeat(20) }] };
    const first = await prepareRequest("abschluss", { fields: {}, work });
    expect(String(first.messages[0].content)).toContain("GEHEIMER-KAPITELTEXT");
    const follow = await prepareRequest("abschluss", { fields: {}, work, history: turns(1) });
    expect(String(follow.messages[0].content)).not.toContain("GEHEIMER-KAPITELTEXT");
    expect(follow.minBudgetMicro).toBe(CHAT.followMinBudgetCents * 1_000_000);
  });
});
