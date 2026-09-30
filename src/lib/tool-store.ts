import type { Treffer } from "./meta";

// Zustand der Tools außerhalb der Seiten: Ergebnisse, laufende Abrufe und Eingaben bleiben beim Wechseln der Seite erhalten.
// Das spart Tokens, weil man nach dem Zurückgehen nichts neu berechnen muss und ein laufender Abruf nicht doppelt gestartet wird.
// Gespeichert wird nur im Browser (sessionStorage, endet mit dem Tab). Nichts davon geht auf den Server. Beim Abmelden wird alles gelöscht.

export type Phase = "idle" | "waiting" | "streaming" | "done" | "error";

export interface StreamState {
  phase: Phase;
  answer: string;
  error: string;
  treffer: Treffer[];
  sig: string; // Fingerabdruck der Eingabe, mit der das Ergebnis berechnet wurde
}

export const IDLE: StreamState = { phase: "idle", answer: "", error: "", treffer: [], sig: "" };

const PREFIX = "wsh:";
const streams = new Map<string, StreamState>();
const values = new Map<string, unknown>();
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function persist(key: string, value: unknown | undefined) {
  const s = storage();
  if (!s) return;
  try {
    if (value === undefined) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt: dann bleibt der Stand nur im Arbeitsspeicher */
  }
}

function read<T>(key: string): T | undefined {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

const emit = () => listeners.forEach((l) => l());
export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

// --- Ergebnisse der KI ---
export function getStream(key: string): StreamState {
  let s = streams.get(key);
  if (!s) {
    const saved = read<StreamState>(`${PREFIX}s:${key}`);
    s = saved && saved.phase === "done" ? saved : IDLE;
    streams.set(key, s);
  }
  return s;
}

export function setStream(key: string, next: StreamState) {
  streams.set(key, next);
  // Nur fertige Ergebnisse überleben ein Neuladen; laufende und fehlerhafte nicht.
  persist(`${PREFIX}s:${key}`, next.phase === "done" ? next : undefined);
  emit();
}

export function isRunning(key: string): boolean {
  const p = getStream(key).phase;
  return p === "waiting" || p === "streaming";
}

// --- Eingaben und Zwischenstände ---
export function getValue<T>(key: string, fallback: T): T {
  if (!values.has(key)) {
    const saved = read<T>(`${PREFIX}v:${key}`);
    if (saved === undefined) return fallback;
    values.set(key, saved);
  }
  return values.get(key) as T;
}

export function setValue<T>(key: string, value: T) {
  values.set(key, value);
  persist(`${PREFIX}v:${key}`, value);
  emit();
}

// Alles vergessen (Abmelden, Wechsel des Zugangscodes).
export function clearToolState() {
  streams.clear();
  values.clear();
  const s = storage();
  if (s) {
    for (const k of Object.keys(s).filter((k) => k.startsWith(PREFIX))) {
      try {
        s.removeItem(k);
      } catch {
        /* ignorieren */
      }
    }
  }
  emit();
}

// Fingerabdruck einer Anfrage: gleiche Eingabe (und gleicher Modus) ergibt denselben Wert.
export function signature(payload: { json?: object; form?: FormData }, mode: string): string {
  if (payload.json) return JSON.stringify({ ...payload.json, mode });
  const parts: unknown[] = [mode];
  payload.form?.forEach((v, k) => parts.push([k, v instanceof File ? [v.name, v.size, v.lastModified] : v]));
  return JSON.stringify(parts);
}
