import { clean } from "./tool-input";
import type { Work } from "./work";

// Bausteine, mit denen der Server Teile der gespeicherten Arbeit als Kontext für die KI aufbereitet.
// Alles ist bereinigt (keine spitzen Klammern) und kommt später in den <nutzereingabe>-Rahmen (= Daten).

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} […]` : s);

export function ctxThema(w: Work | null): string[] {
  if (!w) return [];
  const l: string[] = [];
  if (w.fach.trim()) l.push(`Fach der Arbeit: ${clean(w.fach)}`);
  if (w.thema.trim()) l.push(`Thema der Arbeit: ${clean(w.thema)}`);
  if (w.fragestellung.trim()) l.push(`Fragestellung der Arbeit: ${clean(w.fragestellung)}`);
  return l;
}

export function ctxGliederung(w: Work | null): string[] {
  return w?.gliederung.trim() ? ["Gliederung der Arbeit:", clean(w.gliederung)] : [];
}

export function ctxQuellenTitel(w: Work | null, max = 30): string[] {
  const q = (w?.quellen ?? []).filter((x) => x.status !== "verworfen" && x.titel.trim()).slice(0, max);
  if (q.length === 0) return [];
  return ["Quellenliste der Arbeit:", ...q.map((x, i) => `- Q${i + 1}: ${clean(x.titel)}${x.notiz.trim() ? ` (${clean(cut(x.notiz, 200))})` : ""}`)];
}

export function ctxKapitelAuszuege(w: Work | null, perChars = 700, maxKapitel = 12): string[] {
  const k = (w?.kapitel ?? []).filter((x) => x.text.trim()).slice(0, maxKapitel);
  if (k.length === 0) return [];
  return ["Auszüge aus den geschriebenen Kapiteln:", ...k.map((x) => `Kapitel „${clean(x.titel)}“ (Anfang): ${clean(cut(x.text.trim(), perChars))}`)];
}

// Alles, was für den Abschluss-Check gebraucht wird.
export function ctxVollstaendig(w: Work): string[] {
  const l = [...ctxThema(w), ...ctxGliederung(w)];
  for (const k of w.kapitel) {
    l.push(`Kapitel „${clean(k.titel) || "ohne Titel"}“:`);
    l.push(k.text.trim() ? clean(k.text) : "(noch nicht geschrieben)");
  }
  const q = w.quellen.filter((x) => x.status !== "verworfen");
  if (q.length) {
    l.push("Quellenliste der Arbeit:");
    q.forEach((x, i) => l.push(`- Q${i + 1}: ${clean(x.titel)}${x.url ? ` (${clean(x.url)})` : ""}${x.notiz.trim() ? ` – ${clean(cut(x.notiz, 200))}` : ""}`));
  } else {
    l.push("Quellenliste der Arbeit: (leer)");
  }
  return l;
}

export function kapitelCharCount(w: Work): number {
  return w.kapitel.reduce((n, k) => n + k.text.trim().length, 0);
}
