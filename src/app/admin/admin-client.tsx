"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { summarize } from "@/lib/admin-summary";

interface Row {
  id: string;
  name: string;
  budgetCents: number;
  chargedCents: number; // verrechnet, das sieht auch der Schüler
  restCents: number;
  costCents: number; // echte API-Kosten
  profitCents: number;
  requests: number;
  active: boolean;
  hidden: boolean;
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
  const [showHidden, setShowHidden] = useState(false);
  const [markup, setMarkup] = useState<number | null>(null);

  const apply = useCallback((r: Awaited<ReturnType<typeof api>>) => {
    if (r.status === 401) setState("login");
    else if (r.ok) {
      setRows(r.data.codes);
      setMarkup(r.data.markupPercent ?? null);
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

  const summary = useMemo(() => summarize(rows), [rows]);
  const hiddenCount = rows.filter((r) => r.hidden).length;
  const visible = showHidden ? rows : rows.filter((r) => !r.hidden);

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
          <button className={`${small} mt-2`} onClick={() => setNewCode(null)}>Schließen</button>
        </div>
      )}

      <section aria-label="Auswertung" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Verbraucht (verrechnet)", summary.chargedCents, "Das sehen die Nutzer."],
          ["Echte API-Kosten", summary.costCents, "Das zahlst du an Anthropic."],
          ["Gewinn", summary.profitCents, "Verrechnet minus echte Kosten."],
          ["Offenes Guthaben", summary.openCents, "Noch nicht verbraucht (nur aktive Codes)."],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded border border-zinc-300 bg-white p-3">
            <p className="text-xs text-zinc-600">{label as string}</p>
            <p className="text-lg font-semibold">{fmt(value as number)} Cent</p>
            <p className="text-xs text-zinc-500">{hint as string}</p>
          </div>
        ))}
      </section>
      <p className="mb-2 text-xs text-zinc-500">Alle Summen über alle {summary.codes} Codes (auch ausgeblendete). Aufschlag: {markup ?? "…"} % auf die echten Kosten. US-Cent.</p>

      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Ausgeblendete Nutzer anzeigen ({hiddenCount})
      </label>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-400">
              <th className="p-2">Name</th>
              <th className="p-2">Guthaben</th>
              <th className="p-2">Verbraucht</th>
              <th className="p-2">Rest</th>
              <th className="p-2">Echte Kosten</th>
              <th className="p-2">Gewinn</th>
              <th className="p-2">Anfragen</th>
              <th className="p-2">Zuletzt genutzt</th>
              <th className="p-2">Status</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={`border-b border-zinc-200 ${r.hidden ? "bg-zinc-100 text-zinc-500" : ""}`}>
                <td className="p-2 font-medium">{r.name}{r.hidden && " (ausgeblendet)"}</td>
                <td className="p-2">{fmt(r.budgetCents)}</td>
                <td className="p-2">{fmt(r.chargedCents)}</td>
                <td className="p-2">{fmt(r.restCents)}</td>
                <td className="p-2">{fmt(r.costCents)}</td>
                <td className="p-2">{fmt(r.profitCents)}</td>
                <td className="p-2">{r.requests}</td>
                <td className="p-2">{fmtDate(r.lastUsedAt)}</td>
                <td className="p-2">{r.active ? "aktiv" : "gesperrt"}</td>
                <td className="flex flex-wrap gap-1 p-2">
                  <button className={small} onClick={() => topUp(r)}>Aufladen</button>
                  <button className={small} onClick={() => patch(r.id, { active: !r.active })}>{r.active ? "Sperren" : "Entsperren"}</button>
                  <button className={small} onClick={() => patch(r.id, { hidden: !r.hidden })}>{r.hidden ? "Einblenden" : "Ausblenden"}</button>
                  <button className={small} onClick={() => rename(r)}>Umbenennen</button>
                  <button className={small} onClick={() => arbeitLoeschen(r)}>Arbeit löschen</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td className="p-2 text-zinc-600" colSpan={10}>{rows.length === 0 ? "Noch keine Codes." : "Alle Nutzer sind ausgeblendet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
