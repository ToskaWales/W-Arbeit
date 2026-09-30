"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { newId, useWork, type SaveState } from "@/components/work-provider";
import { WORK_LIMITS as L } from "@/config/work";
import { computeRoadmap, nextStep, type StepStatus } from "@/lib/roadmap";
import type { Kapitel, OffenerPunkt, Quelle, Work } from "@/lib/work";

const input = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base";
const small = "min-h-10 rounded border border-zinc-400 px-3 text-sm";
const icon: Record<StepStatus, string> = { offen: "○", begonnen: "◐", fertig: "●" };

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "",
  dirty: "Ungespeicherte Änderungen …",
  saving: "Speichert …",
  saved: "Gespeichert",
  error: "Nicht gespeichert",
};

function Section({ id, title, hint, children, open = true }: { id?: string; title: string; hint?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details id={id} open={open} className="mb-4 scroll-mt-24 rounded-lg border border-zinc-200 bg-white">
      <summary className="cursor-pointer select-none p-4 text-lg font-semibold">{title}</summary>
      <div className="flex flex-col gap-4 border-t border-zinc-100 p-4">
        {hint && <p className="text-sm text-zinc-600">{hint}</p>}
        {children}
      </div>
    </details>
  );
}

function Field({ label, value, max, onChange, rows, hint }: { label: string; value: string; max: number; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      {rows ? (
        <textarea className={`${input} min-h-20`} rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={input} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      )}
      <span className="text-xs text-zinc-500">
        {hint ? `${hint} · ` : ""}
        {value.length} / {max} Zeichen
      </span>
    </label>
  );
}

function toMarkdown(w: Work): string {
  const parts = [`# Seminararbeit${w.thema ? `: ${w.thema}` : ""}`];
  if (w.fach) parts.push(`Fach: ${w.fach}`);
  if (w.zeitraum) parts.push(`Zeitraum: ${w.zeitraum}`);
  if (w.fragestellung) parts.push(`## Fragestellung\n${w.fragestellung}`);
  if (w.kurzfassung) parts.push(`## Kurzfassung\n${w.kurzfassung}`);
  if (w.gliederung) parts.push(`## Gliederung\n${w.gliederung}`);
  for (const k of w.kapitel) parts.push(`## ${k.titel || "Kapitel"}\n${k.text}`);
  if (w.quellen.length) {
    parts.push("## Quellen\n" + w.quellen.map((q) => `- ${q.titel}${q.url ? ` (${q.url})` : ""}${q.notiz ? ` – ${q.notiz}` : ""}`).join("\n"));
  }
  if (w.punkte.length) parts.push("## Offene Punkte\n" + w.punkte.map((p) => `- [${p.erledigt ? "x" : " "}] ${p.text}`).join("\n"));
  return parts.join("\n\n") + "\n";
}

export default function ArbeitPage() {
  const { work, loaded, loadError, saveState, message, update, removeAll } = useWork();
  const [neuerPunkt, setNeuerPunkt] = useState("");
  const steps = useMemo(() => computeRoadmap(work), [work]);
  const next = nextStep(steps);
  const fertig = steps.filter((s) => s.status === "fertig").length;

  const set = <K extends keyof Work>(key: K) => (value: Work[K]) => update((w) => ({ ...w, [key]: value }));
  const setKapitel = (id: string, patch: Partial<Kapitel>) => update((w) => ({ ...w, kapitel: w.kapitel.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const setQuelle = (id: string, patch: Partial<Quelle>) => update((w) => ({ ...w, quellen: w.quellen.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const setPunkt = (id: string, patch: Partial<OffenerPunkt>) => update((w) => ({ ...w, punkte: w.punkte.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  function kapitelAusGliederung() {
    const titles = work.gliederung.split("\n").map((l) => l.trim()).filter(Boolean);
    update((w) => {
      const vorhanden = new Set(w.kapitel.map((k) => k.titel.trim().toLowerCase()));
      const neu = titles
        .filter((t) => !vorhanden.has(t.toLowerCase()))
        .slice(0, Math.max(0, L.maxKapitel - w.kapitel.length))
        .map((t) => ({ id: newId(), titel: t.slice(0, L.kapitelTitel), text: "" }));
      return { ...w, kapitel: [...w.kapitel, ...neu] };
    });
  }

  function exportieren() {
    const blob = new Blob([toMarkdown(work)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "seminararbeit.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function loeschen() {
    if (!window.confirm("Deine gesamte gespeicherte Seminararbeit wird gelöscht (Kapitel, Quellen, offene Punkte). Das kann nicht rückgängig gemacht werden. Sicherung als Datei vorher gemacht?")) return;
    await removeAll();
  }

  if (!loaded) return <main className="text-zinc-600">Lade deine Seminararbeit …</main>;

  return (
    <main>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Meine Seminararbeit</h1>
        <p role="status" className={`whitespace-nowrap text-sm ${saveState === "error" ? "text-red-700" : "text-zinc-500"}`}>
          {SAVE_TEXT[saveState]}
        </p>
      </div>
      <p className="mb-4 text-zinc-600">Hier liegt deine Arbeit. Alle Tools lesen daraus und du übernimmst ihre Ergebnisse mit einem Klick zurück.</p>

      {loadError && <p role="alert" className="mb-4 rounded bg-amber-50 p-3 text-amber-900">{loadError} Die Tools funktionieren trotzdem, nutzen aber deine gespeicherte Arbeit nicht.</p>}
      {message && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">{message}</p>}

      <section aria-label="Fahrplan" className="mb-5 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">Dein Fahrplan</h2>
        <p className="mb-3 text-sm text-zinc-600">{fertig} von {steps.length} Schritten erledigt</p>
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.id} className={`flex items-start gap-3 rounded p-2 ${next?.id === s.id ? "bg-blue-50" : ""}`}>
              <span aria-label={s.status} className="mt-0.5 w-5 text-center text-lg">{icon[s.status]}</span>
              <div className="flex-1">
                <p className="font-medium">{i + 1}. {s.titel}</p>
                <p className="text-sm text-zinc-600">{s.detail}</p>
              </div>
              <Link href={s.href} className={`${small} flex items-center whitespace-nowrap ${next?.id === s.id ? "border-zinc-900 bg-zinc-900 text-white" : ""}`}>
                {next?.id === s.id ? "Weiter" : "Öffnen"}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <Section title="Grunddaten und Fragestellung">
        <Field label="Fach" value={work.fach} max={L.fach} onChange={set("fach")} />
        <Field label="Thema" value={work.thema} max={L.thema} onChange={set("thema")} />
        <Field label="Verfügbarer Zeitraum" value={work.zeitraum} max={L.zeitraum} onChange={set("zeitraum")} />
        <Field label="Fragestellung" value={work.fragestellung} max={L.fragestellung} onChange={set("fragestellung")} rows={3} />
        <Field label="Kurzfassung" value={work.kurzfassung} max={L.kurzfassung} onChange={set("kurzfassung")} rows={6} hint="Wird im Kolloquium als Grundlage genutzt" />
      </Section>

      <Section title="Gliederung">
        <Field label="Gliederung" value={work.gliederung} max={L.gliederung} onChange={set("gliederung")} rows={8} hint="Ein Punkt pro Zeile" />
        <button type="button" className={small} onClick={kapitelAusGliederung} disabled={!work.gliederung.trim()}>
          Kapitel aus der Gliederung anlegen
        </button>
      </Section>

      <Section title={`Kapitel (${work.kapitel.length})`} hint="Schreibe hier oder füge Text ein. Der Schreibassistent kann Kapitel entwerfen und überarbeiten.">
        {work.kapitel.map((k) => (
          <details key={k.id} className="rounded border border-zinc-200">
            <summary className="cursor-pointer select-none p-3 font-medium">
              {k.titel || "Ohne Titel"} <span className="text-sm font-normal text-zinc-500">({k.text.trim() ? `${k.text.trim().split(/\s+/).length} Wörter` : "leer"})</span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-zinc-100 p-3">
              <Field label="Titel" value={k.titel} max={L.kapitelTitel} onChange={(v) => setKapitel(k.id, { titel: v })} />
              <Field label="Text" value={k.text} max={L.kapitelText} onChange={(v) => setKapitel(k.id, { text: v })} rows={14} />
              <button type="button" className={`${small} self-start`} onClick={() => window.confirm("Dieses Kapitel löschen?") && update((w) => ({ ...w, kapitel: w.kapitel.filter((x) => x.id !== k.id) }))}>
                Kapitel löschen
              </button>
            </div>
          </details>
        ))}
        <button type="button" className={`${small} self-start`} disabled={work.kapitel.length >= L.maxKapitel} onClick={() => update((w) => ({ ...w, kapitel: [...w.kapitel, { id: newId(), titel: "", text: "" }] }))}>
          + Kapitel hinzufügen
        </button>
      </Section>

      <Section title={`Quellen (${work.quellen.length})`} hint="Die Quellenkritik prüft Quellen und die Quellensuche findet neue. Beides übernimmst du hierher.">
        {work.quellen.map((q) => (
          <div key={q.id} className="flex flex-col gap-2 rounded border border-zinc-200 p-3">
            <Field label="Titel" value={q.titel} max={L.quelleTitel} onChange={(v) => setQuelle(q.id, { titel: v })} />
            <Field label="Link (optional)" value={q.url} max={L.quelleUrl} onChange={(v) => setQuelle(q.id, { url: v })} />
            {q.url && /^https?:\/\//i.test(q.url) && (
              <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">Quelle öffnen</a>
            )}
            <Field label="Notiz" value={q.notiz} max={L.quelleNotiz} onChange={(v) => setQuelle(q.id, { notiz: v })} />
            {q.bewertung && (
              <details className="text-sm">
                <summary className="cursor-pointer">Bewertung aus der Quellenkritik</summary>
                <p className="mt-1 whitespace-pre-wrap text-zinc-700">{q.bewertung}</p>
              </details>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm" htmlFor={`st-${q.id}`}>Status</label>
              <select id={`st-${q.id}`} className="min-h-10 rounded border border-zinc-300 px-2" value={q.status} onChange={(e) => setQuelle(q.id, { status: e.target.value as Quelle["status"] })}>
                <option value="neu">neu</option>
                <option value="geprueft">geprüft</option>
                <option value="verworfen">verworfen</option>
              </select>
              <button type="button" className={`${small} ml-auto`} onClick={() => window.confirm("Diese Quelle entfernen?") && update((w) => ({ ...w, quellen: w.quellen.filter((x) => x.id !== q.id) }))}>
                Entfernen
              </button>
            </div>
          </div>
        ))}
        <button type="button" className={`${small} self-start`} disabled={work.quellen.length >= L.maxQuellen} onClick={() => update((w) => ({ ...w, quellen: [...w.quellen, { id: newId(), titel: "", url: "", notiz: "", bewertung: "", status: "neu" }] }))}>
          + Quelle hinzufügen
        </button>
      </Section>

      <Section id="punkte" title={`Offene Punkte (${work.punkte.filter((p) => !p.erledigt).length})`} hint="Hier landen Schwächen aus Abschluss-Check und Kolloquium. Hake sie ab, wenn du sie behoben hast. Mit dem Schreibassistenten (Überarbeiten) kannst du sie angehen.">
        {work.punkte.length === 0 && <p className="text-sm text-zinc-500">Noch keine offenen Punkte.</p>}
        {work.punkte.map((p) => (
          <div key={p.id} className="flex items-start gap-3 rounded border border-zinc-200 p-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={p.erledigt} onChange={(e) => setPunkt(p.id, { erledigt: e.target.checked })} aria-label="Erledigt" />
            <div className="flex-1">
              <p className={p.erledigt ? "text-zinc-500 line-through" : ""}>{p.text}</p>
              <p className="text-xs text-zinc-500">{p.herkunft === "kolloquium" ? "aus dem Kolloquium" : p.herkunft === "abschluss" ? "aus dem Abschluss-Check" : "eigener Punkt"}</p>
            </div>
            <button type="button" className={small} onClick={() => update((w) => ({ ...w, punkte: w.punkte.filter((x) => x.id !== p.id) }))} aria-label="Punkt entfernen">✕</button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = neuerPunkt.trim();
            if (!text) return;
            update((w) => ({ ...w, punkte: [...w.punkte, { id: newId(), text: text.slice(0, L.punktText), herkunft: "eigen", erledigt: false }] }));
            setNeuerPunkt("");
          }}
        >
          <input className={input} value={neuerPunkt} maxLength={L.punktText} onChange={(e) => setNeuerPunkt(e.target.value)} placeholder="Eigenen Punkt hinzufügen" aria-label="Neuer offener Punkt" />
          <button className={`${small} whitespace-nowrap`}>Hinzufügen</button>
        </form>
        {work.punkte.some((p) => p.erledigt) && (
          <button type="button" className={`${small} self-start`} onClick={() => update((w) => ({ ...w, punkte: w.punkte.filter((p) => !p.erledigt) }))}>
            Erledigte entfernen
          </button>
        )}
      </Section>

      <Section title="Sichern und löschen" open={false}>
        <p className="text-sm text-zinc-600">
          Deine Arbeit liegt verschlüsselt auf dem Server und nur mit deinem Zugangscode lesbar. Sie wird gelöscht, wenn du es hier veranlasst. Mache regelmäßig eine Sicherung als Datei.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={small} onClick={exportieren}>Als Datei sichern (.md)</button>
          <button type="button" className={`${small} border-red-700 text-red-800`} onClick={loeschen}>Seminararbeit löschen</button>
        </div>
      </Section>
    </main>
  );
}
