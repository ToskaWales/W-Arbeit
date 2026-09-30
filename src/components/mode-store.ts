"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_MODE, MODES, type Mode } from "@/config/mode";

// Der gewählte Modus wird im Browser gemerkt (wie der Zugangscode) und bei jeder Anfrage mitgeschickt.
// Der Server prüft ihn; er ist keine Berechtigung, sondern die Wahl des Schülers.
const KEY = "wsh_mode";
const listeners = new Set<() => void>();
let memoryMode: Mode = DEFAULT_MODE;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (MODES as readonly string[]).includes(v)) return v as Mode;
  } catch {
    /* ignorieren */
  }
  return memoryMode;
}

export function useMode(): [Mode, (m: Mode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_MODE);
  const setMode = useCallback((m: Mode) => {
    memoryMode = m;
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* ignorieren */
    }
    listeners.forEach((l) => l());
  }, []);
  return [mode, setMode];
}
