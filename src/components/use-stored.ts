"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { getValue, setValue, subscribe } from "@/lib/tool-store";

// Wie useState, aber der Wert bleibt beim Verlassen der Seite erhalten (siehe lib/tool-store).
export function useStoredValue<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const fallback = useRef(initial).current; // stabile Referenz, sonst würde der Snapshot bei jedem Rendern "neu"
  const value = useSyncExternalStore(subscribe, () => getValue(key, fallback), () => fallback);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = getValue(key, fallback);
      setValue(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    [key, fallback],
  );
  return [value, set];
}

// Wie useStoredValue für Formulare, die aus der Seminararbeit vorbefüllt werden. Hat sich die Vorlage
// aus der Arbeit seit dem Speichern geändert, gilt wieder die Vorlage (sonst würden veraltete Angaben auftauchen).
export function useStoredForm<T extends object>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const base = JSON.stringify(initial);
  const [saved, setSaved] = useStoredValue<{ v: T; base: string } | null>(key, null);
  const value = saved && saved.base === base ? saved.v : initial;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = saved && saved.base === base ? saved.v : initial;
      setSaved({ v: typeof next === "function" ? (next as (p: T) => T)(current) : next, base });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, base, setSaved],
  );
  return [value, set];
}
