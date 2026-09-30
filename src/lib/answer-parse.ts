import type { Treffer } from "./meta";

// Liest Teile aus der Antwort der KI aus (Überschriften mit "## "), damit der Schüler Ergebnisse gezielt übernehmen kann.
// Reine Textfunktionen, laufen im Browser. Die KI hält sich an feste Überschriften (siehe src/prompts/).

export function section(text: string, heading: string): string {
  const lines = text.split("\n");
  const want = heading.toLowerCase();
  const start = lines.findIndex((l) => l.startsWith("## ") && l.slice(3).trim().toLowerCase().startsWith(want));
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

function items(s: string, marker: RegExp): string[] {
  const out: string[] = [];
  for (const line of s.split("\n")) {
    const m = line.match(marker);
    if (m) out.push(m[1].trim());
    else if (line.trim() && out.length) out[out.length - 1] += "\n" + line.trim();
  }
  return out;
}

export const bulletItems = (s: string) => items(s, /^\s*-\s+(.*)$/);
export const numberedItems = (s: string) => items(s, /^\s*\d+\.\s+(.*)$/);

export const parseNachbesserungen = (t: string) => bulletItems(section(t, "Nachbesserungen"));
export const parseLuecken = (t: string) => bulletItems(section(t, "Lücken"));
export const parseEntwurf = (t: string) => section(t, "Entwurf");
export const parseGliederungVorschlag = (t: string) => section(t, "Vorschlag für eine überarbeitete Gliederung");

// Die Vorschläge stehen als nummerierte Liste; jeweils die erste Zeile ist die Formulierung, danach kommt die Erläuterung.
export function parseFragestellungVorschlaege(t: string): string[] {
  return numberedItems(section(t, "Vorschläge für eine bessere Fragestellung"))
    .map((i) => {
      const first = i.split("\n")[0].trim();
      // Fragestellungen sind Fragen: alles nach dem ersten Fragezeichen ist Erläuterung (falls die KI sie in dieselbe Zeile schreibt).
      const q = first.indexOf("?");
      return (q >= 0 ? first.slice(0, q + 1) : first).trim();
    })
    .filter(Boolean);
}

// Entfernt Erläuterungen hinter " – " in einer vorgeschlagenen Gliederung, sodass nur die Kapitelzeilen bleiben.
export function stripGliederungNotes(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\s+[–—]\s+.*$/, "").replace(/\s+-\s+.*$/, "").trimEnd())
    .filter((l) => l.trim())
    .join("\n");
}

export interface QuellenVorschlag {
  titel: string;
  autor: string;
  url: string;
  begruendung: string;
}

// "1. Titel | Autor, Jahr | https://... | Begründung". Nur Einträge, deren Link in den ECHTEN Suchtreffern vorkommt, zählen als geprüft.
export function parseEmpfohleneQuellen(text: string, treffer: Treffer[]): Array<QuellenVorschlag & { echt: boolean }> {
  const real = new Set(treffer.map((t) => t.url.replace(/[).,;]+$/, "")));
  return numberedItems(section(text, "Empfohlene Quellen"))
    .map((line) => line.replace(/\n/g, " ").split("|").map((p) => p.trim()))
    .filter((p) => p.length >= 4)
    .map((p) => {
      const url = (p[2].match(/https?:\/\/[^\s)]+/)?.[0] ?? "").replace(/[).,;]+$/, "");
      return { titel: p[0].slice(0, 300), autor: p[1], url, begruendung: p.slice(3).join(" | "), echt: real.has(url) };
    });
}

// Wandelt die Tabelle unter einer Überschrift in lesbaren Text um ("Kriterium: Einschätzung" pro Zeile),
// zum Beispiel für die gespeicherte Bewertung einer Quelle. Die Kopfzeile fällt weg.
export function tabellenText(text: string, heading: string): string {
  const rows = section(text, heading)
    .split("\n")
    .filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
  return rows
    .slice(1)
    .map((cells) => `${cells[0]}: ${cells.slice(1).join(" – ")}`)
    .join("\n");
}
