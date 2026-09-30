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
  },
  {
    id: "roter-faden",
    title: "Rote-Faden-Check",
    description: "Passt deine Gliederung zur Fragestellung?",
  },
  {
    id: "kolloquium",
    title: "Kolloquiums-Simulator",
    description: "Übe die Fragen der Prüfung im Gespräch.",
  },
];
