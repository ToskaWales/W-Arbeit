import { describe, expect, it } from "vitest";
import {
  bulletItems, numberedItems, tabellenText, parseEmpfohleneQuellen, parseEntwurf, parseFragestellungVorschlaege,
  parseGliederungVorschlag, parseLuecken, parseNachbesserungen, section, stripGliederungNotes,
} from "../src/lib/answer-parse";
import { computeRoadmap, nextStep } from "../src/lib/roadmap";
import { emptyWork } from "../src/lib/work";

describe("Antworten auslesen", () => {
  const antwort = `## Gesamteindruck
Solide.

## Nachbesserungen
- [Kapitel 2] Beleg fehlt.
  Suche eine Quelle.
- [Gesamt] Fazit zu kurz.

## Verbesserungsvorschläge
Text`;
  it("findet Abschnitte ohne Rücksicht auf Groß-/Kleinschreibung und schneidet am nächsten ab", () => {
    expect(section(antwort, "gesamteindruck")).toBe("Solide.");
    expect(section(antwort, "Nachbesserungen")).toContain("Fazit zu kurz.");
    expect(section(antwort, "Nachbesserungen")).not.toContain("Text");
    expect(section(antwort, "Gibt es nicht")).toBe("");
  });
  it("liest Listenpunkte mit Folgezeilen", () => {
    expect(parseNachbesserungen(antwort)).toEqual(["[Kapitel 2] Beleg fehlt.\nSuche eine Quelle.", "[Gesamt] Fazit zu kurz."]);
    expect(bulletItems("- a\n- b")).toEqual(["a", "b"]);
    expect(numberedItems("1. eins\n2. zwei\nweiter")).toEqual(["eins", "zwei\nweiter"]);
  });
  it("liest Lücken und Entwurf", () => {
    expect(parseLuecken("## Stärken\n- x\n\n## Lücken\n- y\n- z\n\n## Übungstipps\n- w")).toEqual(["y", "z"]);
    expect(parseEntwurf("## Entwurf\nAbsatz eins.\n\nAbsatz zwei.\n\n## Was du prüfen musst\n- x")).toBe("Absatz eins.\n\nAbsatz zwei.");
  });
  it("nimmt bei Fragestellungs-Vorschlägen nur die Formulierung", () => {
    const t = "## Vorschläge für eine bessere Fragestellung\n\n1. Inwiefern trug X zu Y bei?\n\nSie grenzt auf Z ein.\n\n2. Wie stellte die Presse Y dar?\n\nRegional.\n\n## Nächster Schritt\nText";
    expect(parseFragestellungVorschlaege(t)).toEqual(["Inwiefern trug X zu Y bei?", "Wie stellte die Presse Y dar?"]);
  });
  it("schneidet Erläuterungen ab, die in derselben Zeile stehen", () => {
    const t = "## Vorschläge für eine bessere Fragestellung\n1. Inwiefern trug die Krise zum Ende bei? Das grenzt auf einen Faktor ein; der Kompromiss ist X.\n2. Wie ging die Presse damit um?\n\n## Nächster Schritt\nText";
    expect(parseFragestellungVorschlaege(t)).toEqual(["Inwiefern trug die Krise zum Ende bei?", "Wie ging die Presse damit um?"]);
    expect(parseFragestellungVorschlaege("## Vorschläge für eine bessere Fragestellung\n1. Eine Aussage ohne Fragezeichen")).toEqual(["Eine Aussage ohne Fragezeichen"]);
  });
  it("übernimmt die Gliederung und entfernt auf Wunsch Erläuterungen", () => {
    const t = "## Vorschlag für eine überarbeitete Gliederung\n1 Einleitung – Hinführung\n2 Hauptteil – Antwort\n2.1 Wirtschaft - Zahlen\n\n## Was sich geändert hat\n- x";
    const g = parseGliederungVorschlag(t);
    expect(g).toContain("2.1 Wirtschaft");
    expect(stripGliederungNotes(g)).toBe("1 Einleitung\n2 Hauptteil\n2.1 Wirtschaft");
  });
  it("zählt Quellen nur dann als echt, wenn der Link unter den echten Suchtreffern ist", () => {
    const t = `## Empfohlene Quellen
1. bpb Aufsatz | bpb, 2023 | https://www.bpb.de/x | Guter Einstieg. Nur Deutung.
2. Erfundenes Buch | Autor, 2001 | https://erfunden.de/buch | Klingt gut.
3. Unvollständig | nur zwei Teile

## So prüfst du sie
- x`;
    const q = parseEmpfohleneQuellen(t, [{ titel: "bpb", url: "https://www.bpb.de/x", alter: "" }]);
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({ titel: "bpb Aufsatz", url: "https://www.bpb.de/x", echt: true });
    expect(q[0].begruendung).toContain("Nur Deutung");
    expect(q[1]).toMatchObject({ url: "https://erfunden.de/buch", echt: false });
  });
});

describe("Tabellen", () => {
  it("macht aus der Tabelle lesbaren Text ohne Kopfzeile", () => {
    const t = "## Einschätzung\n| Kriterium | Einschätzung |\n|---|---|\n| Autor | Kein Autor erkennbar. |\n| Aktualität | Von 2012. |\n\n## Weiter\ntext";
    expect(tabellenText(t, "Einschätzung")).toBe("Autor: Kein Autor erkennbar.\nAktualität: Von 2012.");
    expect(tabellenText("nichts", "Einschätzung")).toBe("");
  });
  it("kommt mit drei Spalten zurecht", () => {
    const t = "## Checkliste\n| Prüfpunkt | Urteil | Begründung |\n|---|---|---|\n| Roter Faden | teilweise | Sprung in Kap. 3 |";
    expect(tabellenText(t, "Checkliste")).toBe("Roter Faden: teilweise – Sprung in Kap. 3");
  });
});

describe("Fahrplan", () => {
  const k = (n: number) => ({ id: `k${n}`, titel: `K${n}`, text: "x".repeat(400) });
  it("beginnt bei einer leeren Arbeit mit der Fragestellung", () => {
    const steps = computeRoadmap(emptyWork());
    expect(steps).toHaveLength(7);
    expect(steps.every((s) => s.status === "offen")).toBe(true);
    expect(nextStep(steps)?.id).toBe("fragestellung");
  });
  it("berechnet den Stand aus dem Inhalt", () => {
    const w = {
      ...emptyWork(),
      fragestellung: "Wie stark traf die Inflation die Sparer?",
      gliederung: "1 Einleitung\n2 Hauptteil\n3 Fazit\n",
      quellen: ["a", "b", "c"].map((id) => ({ id, titel: id, url: "", notiz: "", bewertung: "", status: "geprueft" as const })),
      kapitel: [k(1), k(2), { id: "k3", titel: "K3", text: "" }],
    };
    const s = Object.fromEntries(computeRoadmap(w).map((x) => [x.id, x]));
    expect(s.fragestellung.status).toBe("fertig");
    expect(s.quellen.status).toBe("fertig");
    expect(s.gliederung.status).toBe("fertig");
    expect(s.schreiben.status).toBe("begonnen");
    expect(s.schreiben.detail).toBe("2 von 3 Kapiteln geschrieben.");
    expect(nextStep(computeRoadmap(w))?.id).toBe("schreiben");
  });
  it("verwerfene Quellen zählen nicht, offene Punkte steuern das Nachbessern", () => {
    const w = {
      ...emptyWork(),
      quellen: [{ id: "a", titel: "a", url: "", notiz: "", bewertung: "", status: "verworfen" as const }],
      punkte: [
        { id: "p1", text: "x", herkunft: "eigen" as const, erledigt: true },
        { id: "p2", text: "y", herkunft: "eigen" as const, erledigt: false },
      ],
    };
    const s = Object.fromEntries(computeRoadmap(w).map((x) => [x.id, x]));
    expect(s.quellen.status).toBe("offen");
    expect(s.nachbessern.status).toBe("begonnen");
    const alle = computeRoadmap({ ...w, punkte: w.punkte.map((p) => ({ ...p, erledigt: true })) });
    expect(alle.find((x) => x.id === "nachbessern")!.status).toBe("fertig");
  });
  it("alles fertig: kein nächster Schritt", () => {
    const w = {
      ...emptyWork(),
      fragestellung: "Eine ausreichend lange Fragestellung?",
      gliederung: "1 Einleitung\n2 Hauptteil\n3 Fazit\n4 Ausblick",
      quellen: ["a", "b", "c"].map((id) => ({ id, titel: id, url: "", notiz: "", bewertung: "", status: "geprueft" as const })),
      kapitel: [k(1), k(2), k(3)],
      punkte: [{ id: "p", text: "x", herkunft: "abschluss" as const, erledigt: true }],
      meilensteine: { abschlussCheck: 1, kolloquium: 2 },
    };
    expect(nextStep(computeRoadmap(w))).toBeNull();
  });
});

import { ersetzeOffenePunkte } from "../src/lib/punkte";
import { WORK_LIMITS } from "../src/config/work";

describe("Offene Punkte", () => {
  let n = 0;
  const id = () => `n${++n}`;
  const punkt = (text: string, herkunft: "eigen" | "abschluss" | "kolloquium", erledigt = false) => ({ id: `p-${text}`, text, herkunft, erledigt });

  it("ersetzt offene Punkte derselben Quelle, behält Erledigtes und Fremdes", () => {
    const alt = [punkt("alt offen", "abschluss"), punkt("alt erledigt", "abschluss", true), punkt("eigener", "eigen"), punkt("aus Kolloquium", "kolloquium")];
    const neu = ersetzeOffenePunkte(alt, "abschluss", ["neu eins", "neu zwei"], id);
    expect(neu.map((p) => p.text)).toEqual(["alt erledigt", "eigener", "aus Kolloquium", "neu eins", "neu zwei"]);
    expect(neu.at(-1)).toMatchObject({ herkunft: "abschluss", erledigt: false });
  });
  it("übernimmt keine Doppelten, keine leeren Texte und normalisiert Leerraum", () => {
    const neu = ersetzeOffenePunkte([punkt("Schon erledigt", "abschluss", true)], "abschluss", ["  neu \n eins ", "neu eins", "", "schon ERLEDIGT"], id);
    expect(neu.map((p) => p.text)).toEqual(["Schon erledigt", "neu eins"]);
  });
  it("hält die Höchstgrenzen ein", () => {
    const viele = Array.from({ length: WORK_LIMITS.maxPunkte + 20 }, (_, i) => `Punkt ${i}`);
    expect(ersetzeOffenePunkte([], "kolloquium", viele, id)).toHaveLength(WORK_LIMITS.maxPunkte);
    expect(ersetzeOffenePunkte([], "kolloquium", ["x".repeat(WORK_LIMITS.punktText + 50)], id)[0].text).toHaveLength(WORK_LIMITS.punktText);
  });
});
