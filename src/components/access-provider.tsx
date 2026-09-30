"use client";

import Link from "next/link";
import { ModeSwitch } from "./mode-switch";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

const KEY = "wsh_code";
const listeners = new Set<() => void>();
let memoryCode: string | null = null; // Notlösung, falls der Browser das Speichern verbietet

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memoryCode;
  } catch {
    return memoryCode;
  }
}
function setStoredCode(code: string | null) {
  memoryCode = code;
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
  listeners.forEach((l) => l());
}

interface AccessContext {
  code: string;
  restCents: number | null;
  refreshBudget: () => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AccessContext | null>(null);

export function useAccess(): AccessContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccess braucht den AccessProvider");
  return v;
}

export const formatBudget = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} $`;

async function fetchSession(code: string) {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, restCents: data.restCents as number | undefined, error: data.error as string | undefined };
  } catch {
    return { status: 0, restCents: undefined, error: "Keine Verbindung. Prüfe dein Internet." };
  }
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  // undefined = wird noch geladen (Server), null = nicht angemeldet
  const code = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  const [restCents, setRestCents] = useState<number | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetchSession(code).then((r) => {
      if (cancelled) return;
      if (r.restCents !== undefined) setRestCents(r.restCents);
      else if (r.status === 401 || r.status === 403) setStoredCode(null); // Code wurde inzwischen gesperrt
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const refreshBudget = useCallback(async () => {
    if (!code) return;
    const r = await fetchSession(code);
    if (r.restCents !== undefined) setRestCents(r.restCents);
  }, [code]);

  const logout = useCallback(() => {
    setRestCents(null);
    setStoredCode(null);
  }, []);

  if (code === undefined) return <p className="p-6 text-zinc-600">Lade …</p>;
  if (!code) return <LoginScreen onLogin={(c, rest) => (setRestCents(rest), setStoredCode(c))} />;

  return (
    <Ctx.Provider value={{ code, restCents, refreshBudget, logout }}>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="whitespace-nowrap font-semibold">W-Seminar-Helfer</Link>
          <div className="flex items-center gap-2 whitespace-nowrap text-sm">
            <span aria-label="Restbudget">
              Rest: <strong>{restCents === null ? "…" : formatBudget(restCents)}</strong>
            </span>
            <button onClick={logout} className="rounded border border-zinc-300 px-2 py-1">Abmelden</button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-3">
          <ModeSwitch />
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</div>
      <footer className="mx-auto w-full max-w-2xl px-4 pb-6 text-xs text-zinc-500">
        <p>Die KI kann sich irren. Prüfe Angaben nach und gib die KI-Hilfe in deiner Arbeit an.</p>
        <LegalLinks />
      </footer>
    </Ctx.Provider>
  );
}

function LegalLinks() {
  return (
    <p className="mt-1 flex gap-3">
      <Link href="/impressum" className="underline">Impressum</Link>
      <Link href="/datenschutz" className="underline">Datenschutz</Link>
    </p>
  );
}

function LoginScreen({ onLogin }: { onLogin: (code: string, restCents: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const code = value.trim().toUpperCase();
    const r = await fetchSession(code);
    setBusy(false);
    if (r.restCents === undefined) return setError(r.error ?? "Anmeldung nicht möglich.");
    onLogin(code, r.restCents);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">W-Seminar-Helfer</h1>
      <p className="mb-6 text-zinc-600">
        Dein Sparringspartner und deine Schreibhilfe für die W-Seminararbeit. Im Sparring-Modus stellt die KI Fragen und zeigt Schwächen auf, im Schreibmodus formuliert sie auch aus.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="code" className="font-medium">Dein Zugangscode</label>
        <input
          id="code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-12 rounded border border-zinc-300 px-3 text-base uppercase tracking-widest"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="z. B. AB12CD34EF56"
        />
        <button disabled={busy || value.trim() === ""} className="min-h-12 rounded bg-zinc-900 px-4 text-base text-white disabled:opacity-50">
          {busy ? "Prüfe …" : "Anmelden"}
        </button>
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </form>
      <p className="mt-6 text-sm text-zinc-500">Du hast noch keinen Code? Frag die Person, die dir den Zugang gegeben hat.</p>
      <div className="mt-6 text-xs text-zinc-500"><LegalLinks /></div>
    </main>
  );
}
