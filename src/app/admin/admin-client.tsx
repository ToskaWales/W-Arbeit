"use client";

import { useCallback, useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
  budgetCents: number;
  costCents: number;
  requests: number;
  active: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}

const fmt = (n: number) => n.toFixed(2);
const fmtDate = (t: number | null) => (t ? new Date(t).toLocaleString("de-DE") : "nie");

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

export default function AdminClient() {
  const [state, setState] = useState<"loading" | "login" | "in">("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("500");
  const [newCode, setNewCode] = useState<{ name: string; code: string } | null>(null);

  const apply = useCallback((r: Awaited<ReturnType<typeof api>>) => {
    if (r.status === 401) setState("login");
    else if (r.ok) {
      setRows(r.data.codes);
      setState("in");
    }
  }, []);

  const load = useCallback(async () => apply(await api("/api/admin/codes", "GET")), [apply]);

  useEffect(() => {
    let cancelled = false;
    api("/api/admin/codes", "GET").then((r) => {
      if (!cancelled) apply(r);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await api("/api/admin/login", "POST", { password });
    if (!r.ok) return setError(r.data.error ?? "Anmeldung fehlgeschlagen.");
    setPassword("");
    await load();
  }

  async function logout() {
    await api("/api/admin/logout", "POST");
    setRows([]);
    setNewCode(null);
    setState("login");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await api("/api/admin/codes", "POST", { name, budgetCents: Number(budget) });
    if (!r.ok) return setError(r.data.error ?? "Fehler.");
    setNewCode({ name: r.data.name, code: r.data.code });
    setName("");
    await load();
  }

  async function patch(id: string, body: unknown) {
    setError("");
    const r = await api(`/api/admin/codes/${id}`, "PATCH", body);
    if (!r.ok) setError(r.data.error ?? "Fehler.");
    await load();
  }

  async function topUp(row: Row) {
    const v = window.prompt(`Wie viele Cent soll ${row.name} zusätzlich bekommen?`, "500");
    if (v) await patch(row.id, { addCents: Number(v) });
  }

  async function arbeitLoeschen(row: Row) {
    if (!window.confirm(`Die gespeicherte Seminararbeit von ${row.name} unwiderruflich löschen? Der Code bleibt bestehen.`)) return;
    setError("");
    const r = await api(`/api/admin/codes/${row.id}/work`, "DELETE");
    if (!r.ok) setError(r.data.error ?? "Fehler.");
    else window.alert("Die Seminararbeit wurde gelöscht.");
  }

  async function rename(row: Row) {
    const v = window.prompt("Neuer Name:", row.name);
    if (v) await patch(row.id, { name: v });
  }

  const input = "rounded border border-zinc-300 bg-white px-3 py-2 text-black";
  const btn = "rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50";
  const small = "rounded border border-zinc-400 px-2 py-1 text-sm";

  if (state === "loading") return <main className="p-6">Lade …</main>;

  if (state === "login") {
    return (
      <main className="mx-auto w-full max-w-sm p-6">
        <h1 className="mb-4 text-xl font-semibold">Admin</h1>
        <form onSubmit={login} className="flex flex-col gap-3">
          <input
            type="password"
            className={input}
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className={btn} type="submit">Anmelden</button>
          {error && <p role="alert" className="text-red-700">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin: Zugangscodes</h1>
        <button className={small} onClick={logout}>Abmelden</button>
      </div>

      <form onSubmit={create} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className={input} placeholder="Name (Pflicht), z. B. Lisa M." value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={`${input} sm:w-32`} type="number" min="1" placeholder="Cent" value={budget} onChange={(e) => setBudget(e.target.value)} required />
        <button className={btn} type="submit">Code erstellen</button>
      </form>
      <p className="mb-4 text-sm text-zinc-600">Budget in US-Cent (100 = 1 $).</p>

      {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}

      {newCode && (
        <div className="mb-4 rounded border border-green-700 bg-green-50 p-3 text-black">
          Code für <strong>{newCode.name}</strong>: <code className="text-lg font-bold">{newCode.code}</code>
          <p className="text-sm">Wird nur jetzt einmal angezeigt. Jetzt kopieren und weitergeben.</p>
          <button className={`${small} mt-2`} onClick={() => setNewCode(null)}>Ausblenden</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-400">
              <th className="p-2">Name</th>
              <th className="p-2">Kosten (Cent)</th>
              <th className="p-2">Budget (Cent)</th>
              <th className="p-2">Anfragen</th>
              <th className="p-2">Zuletzt genutzt</th>
              <th className="p-2">Status</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-200">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2">{fmt(r.costCents)}</td>
                <td className="p-2">{fmt(r.budgetCents)}</td>
                <td className="p-2">{r.requests}</td>
                <td className="p-2">{fmtDate(r.lastUsedAt)}</td>
                <td className="p-2">{r.active ? "aktiv" : "gesperrt"}</td>
                <td className="flex flex-wrap gap-1 p-2">
                  <button className={small} onClick={() => topUp(r)}>Aufladen</button>
                  <button className={small} onClick={() => patch(r.id, { active: !r.active })}>{r.active ? "Sperren" : "Entsperren"}</button>
                  <button className={small} onClick={() => rename(r)}>Umbenennen</button>
                  <button className={small} onClick={() => arbeitLoeschen(r)}>Arbeit löschen</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-2 text-zinc-600" colSpan={7}>Noch keine Codes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
