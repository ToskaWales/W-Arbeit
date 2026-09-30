"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeRoadmap, nextStep } from "@/lib/roadmap";
import { useWork } from "./work-provider";

// Kurzer Überblick auf der Startseite: Fortschritt und der nächste Schritt aus dem Fahrplan.
export function ArbeitKarte() {
  const { work, loaded } = useWork();
  const steps = useMemo(() => computeRoadmap(work), [work]);
  const next = nextStep(steps);
  const fertig = steps.filter((s) => s.status === "fertig").length;

  return (
    <section aria-label="Meine Seminararbeit" className="mb-5 rounded-lg border border-zinc-300 bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Meine Seminararbeit</h2>
        <Link href="/arbeit" className="text-sm underline">Alles ansehen</Link>
      </div>
      {!loaded ? (
        <p className="text-sm text-zinc-500">Lade …</p>
      ) : (
        <>
          <div className="mb-2 h-2 overflow-hidden rounded bg-zinc-200" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={fertig} aria-label="Fortschritt">
            <div className="h-full bg-zinc-900" style={{ width: `${(fertig / steps.length) * 100}%` }} />
          </div>
          <p className="mb-3 text-sm text-zinc-600">{fertig} von {steps.length} Schritten erledigt</p>
          {next ? (
            <div className="flex items-center justify-between gap-3 rounded bg-blue-50 p-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-900">Nächster Schritt</p>
                <p className="font-medium">{next.titel}</p>
                <p className="text-sm text-zinc-700">{next.detail}</p>
              </div>
              <Link href={next.href} className="flex min-h-12 items-center whitespace-nowrap rounded bg-zinc-900 px-4 text-white">Weiter</Link>
            </div>
          ) : (
            <p className="rounded bg-green-50 p-3 text-green-900">Alle Schritte sind erledigt. Viel Erfolg bei der Abgabe und im Kolloquium!</p>
          )}
        </>
      )}
    </section>
  );
}
