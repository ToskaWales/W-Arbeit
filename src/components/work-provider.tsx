"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAccess } from "./access-provider";
import { emptyWork, type Work } from "@/lib/work";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface WorkContext {
  work: Work;
  loaded: boolean;
  loadError: string;
  saveState: SaveState;
  message: string;
  update: (fn: (w: Work) => Work) => void;
  saveNow: () => Promise<boolean>; // wartet, bis alles gespeichert ist (Tools lesen die Arbeit auf dem Server)
  removeAll: () => Promise<boolean>;
}
const Ctx = createContext<WorkContext | null>(null);

export function useWork(): WorkContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWork braucht den WorkProvider");
  return v;
}

export const newId = () => (globalThis.crypto?.randomUUID?.().slice(0, 12) ?? Math.random().toString(36).slice(2, 14)).replace(/[^A-Za-z0-9_-]/g, "x");

async function request(code: string, method: string, body?: unknown) {
  try {
    const res = await fetch("/api/work", {
      method,
      headers: { "x-access-code": code, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch {
    return { status: 0, ok: false, data: { error: "Keine Verbindung. Prüfe dein Internet." } };
  }
}

export function WorkProvider({ children }: { children: React.ReactNode }) {
  const { code, logout } = useAccess();
  const [work, setWork] = useState<Work>(emptyWork());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const latest = useRef<Work>(work);
  const version = useRef(0);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  useEffect(() => {
    let cancelled = false;
    request(code, "GET").then((r) => {
      if (cancelled) return;
      if (r.ok) {
        latest.current = r.data.work;
        version.current = r.data.work.version;
        setWork(r.data.work);
        setLoadError("");
      } else {
        if (r.status === 401 || r.status === 403) logout();
        setLoadError(r.data.error ?? "Deine Seminararbeit konnte nicht geladen werden.");
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [code, logout]);

  // Ein Speichervorgang. Änderungen, die währenddessen dazukommen, speichert die Schleife in saveNow direkt danach.
  const saveOnce = useCallback(async (): Promise<boolean> => {
    dirty.current = false;
    setSaveState("saving");
    const r = await request(code, "PUT", { work: { ...latest.current, version: version.current } });
    if (r.ok) {
      version.current = r.data.work.version;
      latest.current = { ...latest.current, version: r.data.work.version, updatedAt: r.data.work.updatedAt };
      setWork((w) => ({ ...w, version: r.data.work.version, updatedAt: r.data.work.updatedAt }));
      setMessage("");
      setSaveState(dirty.current ? "dirty" : "saved");
      return true;
    }
    if (r.status === 409 && r.data.work) {
      // Zwei Fenster: die neueste Fassung gewinnt, damit nichts überschrieben wird.
      latest.current = r.data.work;
      version.current = r.data.work.version;
      dirty.current = false;
      setWork(r.data.work);
    } else {
      dirty.current = true;
    }
    setMessage(r.data.error ?? "Speichern fehlgeschlagen.");
    setSaveState("error");
    return false;
  }, [code]);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    const run = chain.current.then(async () => {
      while (dirty.current) if (!(await saveOnce())) return false;
      return true;
    });
    chain.current = run;
    return run;
  }, [saveOnce]);

  const update = useCallback(
    (fn: (w: Work) => Work) => {
      const next = fn(latest.current);
      latest.current = next;
      dirty.current = true;
      setWork(next);
      setSaveState("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveNow(), 1200);
    },
    [saveNow],
  );

  const removeAll = useCallback(async () => {
    clearTimeout(timer.current);
    dirty.current = false;
    const r = await request(code, "DELETE");
    if (!r.ok) {
      setMessage(r.data.error ?? "Löschen fehlgeschlagen.");
      setSaveState("error");
      return false;
    }
    const fresh = emptyWork();
    latest.current = fresh;
    version.current = 0;
    setWork(fresh);
    setMessage("");
    setSaveState("idle");
    return true;
  }, [code]);

  // Nichts verlieren: beim Verlassen der Seite oder Wegwischen des Tabs noch schnell speichern.
  useEffect(() => {
    const flush = () => {
      if (dirty.current) void saveNow();
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", warn);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", warn);
    };
  }, [saveNow]);

  const value = useMemo(
    () => ({ work, loaded, loadError, saveState, message, update, saveNow, removeAll }),
    [work, loaded, loadError, saveState, message, update, saveNow, removeAll],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
