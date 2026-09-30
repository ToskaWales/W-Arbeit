import { WORK_LIMITS as L } from "../config/work";

export type QuelleStatus = "neu" | "geprueft" | "verworfen";
export type PunktHerkunft = "kolloquium" | "abschluss" | "eigen";

export interface Kapitel {
  id: string;
  titel: string;
  text: string;
}
export interface Quelle {
  id: string;
  titel: string;
  url: string;
  notiz: string;
  bewertung: string;
  status: QuelleStatus;
}
export interface OffenerPunkt {
  id: string;
  text: string;
  herkunft: PunktHerkunft;
  erledigt: boolean;
}
export interface Work {
  version: number; // erhöht der Server bei jedem Speichern
  updatedAt: number;
  fach: string;
  thema: string;
  zeitraum: string;
  fragestellung: string;
  kurzfassung: string;
  gliederung: string;
  kapitel: Kapitel[];
  quellen: Quelle[];
  punkte: OffenerPunkt[];
  meilensteine: { abschlussCheck: number | null; kolloquium: number | null };
}

export class WorkError extends Error {}

export function emptyWork(): Work {
  return {
    version: 0,
    updatedAt: 0,
    fach: "",
    thema: "",
    zeitraum: "",
    fragestellung: "",
    kurzfassung: "",
    gliederung: "",
    kapitel: [],
    quellen: [],
    punkte: [],
    meilensteine: { abschlussCheck: null, kolloquium: null },
  };
}

function str(v: unknown, max: number, label: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new WorkError(`„${label}“ ist ungültig.`);
  if (v.length > max) throw new WorkError(`„${label}“ ist zu lang (maximal ${max} Zeichen).`);
  // Steuerzeichen außer Zeilenumbruch und Tab entfernen
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function id(v: unknown, label: string): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(v)) throw new WorkError(`Ungültige ID bei „${label}“.`);
  return v;
}

function list(v: unknown, max: number, label: string): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new WorkError(`„${label}“ ist ungültig.`);
  if (v.length > max) throw new WorkError(`Zu viele Einträge bei „${label}“ (maximal ${max}).`);
  return v;
}

function obj(v: unknown, label: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new WorkError(`„${label}“ ist ungültig.`);
  return v as Record<string, unknown>;
}

function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new WorkError(`Doppelte IDs bei „${label}“.`);
}

// Nur http(s)-Links, damit z. B. "javascript:" nie als Link erscheinen kann.
export function safeUrl(v: string): string {
  const t = v.trim();
  return /^https?:\/\/[^\s]+$/i.test(t) ? t : "";
}

const stamp = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null);

// Prüft Daten vom Browser streng und übernimmt nur bekannte Felder. version/updatedAt setzt der Server.
export function sanitizeWork(input: unknown): Work {
  const w = obj(input, "Seminararbeit");
  const out = emptyWork();
  out.fach = str(w.fach, L.fach, "Fach");
  out.thema = str(w.thema, L.thema, "Thema");
  out.zeitraum = str(w.zeitraum, L.zeitraum, "Zeitraum");
  out.fragestellung = str(w.fragestellung, L.fragestellung, "Fragestellung");
  out.kurzfassung = str(w.kurzfassung, L.kurzfassung, "Kurzfassung");
  out.gliederung = str(w.gliederung, L.gliederung, "Gliederung");

  out.kapitel = list(w.kapitel, L.maxKapitel, "Kapitel").map((k) => {
    const o = obj(k, "Kapitel");
    return { id: id(o.id, "Kapitel"), titel: str(o.titel, L.kapitelTitel, "Kapiteltitel"), text: str(o.text, L.kapitelText, "Kapiteltext") };
  });
  unique(out.kapitel.map((k) => k.id), "Kapitel");

  out.quellen = list(w.quellen, L.maxQuellen, "Quellen").map((q) => {
    const o = obj(q, "Quelle");
    const status = o.status === "geprueft" || o.status === "verworfen" ? o.status : "neu";
    return {
      id: id(o.id, "Quelle"),
      titel: str(o.titel, L.quelleTitel, "Quellentitel"),
      url: safeUrl(str(o.url, L.quelleUrl, "Link")),
      notiz: str(o.notiz, L.quelleNotiz, "Notiz"),
      bewertung: str(o.bewertung, L.quelleBewertung, "Bewertung"),
      status,
    } satisfies Quelle;
  });
  unique(out.quellen.map((q) => q.id), "Quellen");

  out.punkte = list(w.punkte, L.maxPunkte, "Offene Punkte").map((p) => {
    const o = obj(p, "Offener Punkt");
    const herkunft = o.herkunft === "kolloquium" || o.herkunft === "abschluss" ? o.herkunft : "eigen";
    return { id: id(o.id, "Offener Punkt"), text: str(o.text, L.punktText, "Offener Punkt"), herkunft, erledigt: o.erledigt === true } satisfies OffenerPunkt;
  });
  unique(out.punkte.map((p) => p.id), "Offene Punkte");

  const m = w.meilensteine === undefined ? {} : obj(w.meilensteine, "Fortschritt");
  out.meilensteine = { abschlussCheck: stamp(m.abschlussCheck), kolloquium: stamp(m.kolloquium) };

  if (contentLength(out) > L.gesamt) throw new WorkError(`Deine Arbeit ist zu lang (maximal ${L.gesamt} Zeichen insgesamt).`);
  // Die Version schickt der Browser separat mit (Konfliktprüfung), sie ist keine Nutzdaten.
  out.version = typeof w.version === "number" && Number.isInteger(w.version) && w.version >= 0 ? w.version : 0;
  return out;
}

export function contentLength(w: Work): number {
  return (
    w.fach.length + w.thema.length + w.zeitraum.length + w.fragestellung.length + w.kurzfassung.length + w.gliederung.length +
    w.kapitel.reduce((n, k) => n + k.titel.length + k.text.length, 0) +
    w.quellen.reduce((n, q) => n + q.titel.length + q.url.length + q.notiz.length + q.bewertung.length, 0) +
    w.punkte.reduce((n, p) => n + p.text.length, 0)
  );
}

export function isEmptyWork(w: Work): boolean {
  return contentLength(w) === 0;
}
