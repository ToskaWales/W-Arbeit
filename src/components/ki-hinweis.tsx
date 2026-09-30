"use client";

import { useMode } from "./mode-store";

// Hinweis zur Selbstständigkeitserklärung und zur Offenlegung der KI-Nutzung, passend zum Modus.
export function KiHinweis() {
  const [mode] = useMode();
  return (
    <section className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950" aria-label="Hinweis zur KI-Nutzung">
      <h2 className="mb-1 font-semibold">Wichtig für deine Seminararbeit</h2>
      {mode === "schreiben" ? (
        <p>
          Im Schreibmodus formuliert die KI Vorschläge und Texte aus. In deiner Seminararbeit erklärst du, dass du sie selbstständig verfasst und alle Hilfsmittel angegeben hast. Gib die KI-Hilfe deshalb ehrlich an. Prüfe alle Fakten und ersetze die Stellen mit „[Beleg nötig]“ durch echte Quellen. Frag deine Lehrkraft, was an deiner Schule erlaubt ist.
        </p>
      ) : (
        <p>
          Im Sparring-Modus helfen dir die Tools beim Denken, sie schreiben nichts für deine Arbeit. In deiner Seminararbeit erklärst du, dass du sie selbstständig verfasst und alle Hilfsmittel angegeben hast. Wenn du diese Seite benutzt hast, gib das ehrlich an. Frag deine Lehrkraft, wie ihr das an deiner Schule handhabt.
        </p>
      )}
    </section>
  );
}
