import { describe, expect, it } from "vitest";
import { prepareRequest } from "../src/lib/prepare";
import { emptyWork } from "../src/lib/work";
import { GUARDRAILS, GUARDRAILS_SCHREIBEN } from "../src/prompts/guardrails";

const work = { ...emptyWork(), fragestellung: "F?", gliederung: "1 A\n2 B", kapitel: [{ id: "k", titel: "A", text: "Text ".repeat(60) }] };
const FIELDS: Record<string, object> = {
  fragestellung: { fach: "a", thema: "b", fragestellung: "c", zeitraum: "d" },
  quellenkritik: { verwendung: "x", text: "y" },
  "roter-faden": { fragestellung: "f", gliederung: "g" },
  kolloquium: { kurzfassung: "k", schwierigkeit: "normal" },
  abschluss: {},
  quellensuche: { suchauftrag: "x" },
};

describe("Knappe Antworten", () => {
  it("beide Grundregeln verlangen kurze Antworten ohne Einleitung und Schlusssatz", () => {
    for (const g of [GUARDRAILS, GUARDRAILS_SCHREIBEN]) {
      expect(g).toContain("so knapp wie möglich");
      expect(g).toContain("keine Einleitung");
      expect(g).toContain("kein Schlusssatz");
    }
  });
  it("im Schreibmodus dürfen nur Texte zum Übernehmen lang sein", () => {
    expect(GUARDRAILS_SCHREIBEN).toContain("zum Übernehmen dürfen die gewünschte Länge haben");
    expect(GUARDRAILS).not.toContain("dürfen die gewünschte Länge haben");
  });
  it.each(Object.keys(FIELDS))("%s hat in beiden Modi feste Längenvorgaben", async (tool) => {
    for (const mode of ["sparring", "schreiben"]) {
      const r = await prepareRequest(tool, { fields: FIELDS[tool], mode, work, history: tool === "kolloquium" ? [] : undefined });
      expect(r.system, `${tool}/${mode}`).toMatch(/höchstens \d+ Wörter|Genau zwei Stichpunkte|genau eine Suche|Höchstens zwei Sätze|höchstens zwei Sätze/);
    }
  });
  it("Kolloquium-Feedback und Fragen haben harte Grenzen", async () => {
    const hist = [{ role: "assistant", content: "F?" }, { role: "user", content: "A" }];
    const frage = await prepareRequest("kolloquium", { fields: FIELDS.kolloquium, history: [] });
    const fb = await prepareRequest("kolloquium", { fields: FIELDS.kolloquium, history: hist, finish: true });
    expect(frage.system).toContain("höchstens 40 Wörter");
    expect(fb.system).toContain("höchstens 25 Wörtern");
    expect(frage.maxTokens).toBeLessThanOrEqual(300);
    expect(fb.maxTokens).toBeLessThanOrEqual(1000);
  });
});
