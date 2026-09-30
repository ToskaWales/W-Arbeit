import type { Work } from "./work";

export type StepStatus = "offen" | "begonnen" | "fertig";
export interface Step {
  id: string;
  titel: string;
  status: StepStatus;
  detail: string;
  href: string;
  cta: string;
}

const chars = (s: string) => s.trim().length;
const status = (done: boolean, started: boolean): StepStatus => (done ? "fertig" : started ? "begonnen" : "offen");

// Der Fahrplan wird immer aus dem Stand der Arbeit berechnet und nicht extra gespeichert.
export function computeRoadmap(w: Work): Step[] {
  const quellen = w.quellen.filter((q) => q.status !== "verworfen");
  const geprueft = quellen.filter((q) => q.status === "geprueft" || q.bewertung.trim());
  const geschrieben = w.kapitel.filter((k) => chars(k.text) >= 300);
  const offen = w.punkte.filter((p) => !p.erledigt);

  return [
    {
      id: "fragestellung",
      titel: "Fragestellung festlegen",
      status: status(chars(w.fragestellung) >= 15, chars(w.fragestellung) > 0 || chars(w.thema) > 0),
      detail: chars(w.fragestellung) ? "Deine Fragestellung ist gespeichert." : "Lege Fach, Thema und Fragestellung fest.",
      href: "/tools/fragestellung",
      cta: "Fragestellung prüfen",
    },
    {
      id: "quellen",
      titel: "Quellen sammeln und prüfen",
      status: status(geprueft.length >= 3, quellen.length > 0),
      detail: `${quellen.length} Quellen, ${geprueft.length} geprüft (Ziel: mindestens 3).`,
      href: "/tools/quellenkritik",
      cta: "Quellen prüfen und suchen",
    },
    {
      id: "gliederung",
      titel: "Gliederung und roten Faden klären",
      status: status(chars(w.gliederung) >= 30, chars(w.gliederung) > 0),
      detail: chars(w.gliederung) ? "Gliederung gespeichert." : "Noch keine Gliederung.",
      href: "/tools/roter-faden",
      cta: "Gliederung prüfen",
    },
    {
      id: "schreiben",
      titel: "Kapitel schreiben",
      status: status(w.kapitel.length >= 3 && geschrieben.length === w.kapitel.length, geschrieben.length > 0),
      detail: w.kapitel.length ? `${geschrieben.length} von ${w.kapitel.length} Kapiteln geschrieben.` : "Noch keine Kapitel angelegt.",
      href: "/tools/schreibassistent",
      cta: "Schreiben",
    },
    {
      id: "abschluss",
      titel: "Abschluss-Check",
      status: status(w.meilensteine.abschlussCheck !== null, false),
      detail: w.meilensteine.abschlussCheck ? "Abschluss-Check durchgeführt." : "Prüfe die ganze Arbeit, wenn die Kapitel stehen.",
      href: "/tools/abschluss-check",
      cta: "Arbeit prüfen",
    },
    {
      id: "nachbessern",
      titel: "Nachbessern",
      status: status(w.punkte.length > 0 && offen.length === 0, w.punkte.length > 0 && offen.length < w.punkte.length),
      detail: w.punkte.length ? `${offen.length} von ${w.punkte.length} offenen Punkten übrig.` : "Hier landen Punkte aus Abschluss-Check und Kolloquium.",
      href: "/arbeit#punkte",
      cta: "Offene Punkte ansehen",
    },
    {
      id: "kolloquium",
      titel: "Kolloquium üben",
      status: status(w.meilensteine.kolloquium !== null, false),
      detail: w.meilensteine.kolloquium ? "Kolloquium geübt." : "Übe die Prüfungsfragen zu deiner Arbeit.",
      href: "/tools/kolloquium",
      cta: "Kolloquium üben",
    },
  ];
}

export function nextStep(steps: Step[]): Step | null {
  return steps.find((s) => s.status !== "fertig") ?? null;
}
