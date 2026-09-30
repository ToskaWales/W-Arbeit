// Anzeige der Tool-Karten auf der Startseite (enthält nichts Geheimes).
export interface ToolCard {
  id: string;
  title: string;
  description: string;
  href?: string; // ohne href: "kommt bald"
}

export const TOOL_CARDS: ToolCard[] = [
  {
    id: "fragestellung",
    title: "Fragestellungs-Check",
    description: "Trägt deine Fragestellung? Stärken, Schwachstellen und Rückfragen.",
    href: "/tools/fragestellung",
  },
  {
    id: "quellenkritik",
    title: "Quellenkritik",
    description: "Wie belastbar ist eine Quelle für deine These?",
    href: "/tools/quellenkritik",
  },
  {
    id: "roter-faden",
    title: "Rote-Faden-Check",
    description: "Passt deine Gliederung zur Fragestellung?",
    href: "/tools/roter-faden",
  },
  {
    id: "abschluss",
    title: "Abschluss-Check",
    description: "Liest deine ganze Arbeit und listet, was noch nachgebessert werden muss.",
    href: "/tools/abschluss-check",
  },
  {
    id: "kolloquium",
    title: "Kolloquiums-Simulator",
    description: "Übe die Fragen der Prüfung im Gespräch.",
    href: "/tools/kolloquium",
  },
  {
    id: "schreibassistent",
    title: "Schreibassistent",
    description: "Formuliert Einleitung, Abschnitte, Überleitungen oder ein Fazit aus deinen Stichpunkten. Nur im Schreibmodus.",
    href: "/tools/schreibassistent",
  },
];
