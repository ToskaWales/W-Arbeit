import { WORK_LIMITS as L } from "../config/work";
import type { OffenerPunkt, PunktHerkunft } from "./work";

// Übernimmt neue Punkte aus einem Check oder dem Kolloquium. Was der Schüler schon erledigt hat, bleibt.
// Noch offene Punkte aus derselben Quelle ersetzt der neue Durchlauf, damit sich bei jedem Check keine
// leicht umformulierten Doppelgänger ansammeln. Eigene Punkte und Punkte anderer Quellen bleiben unberührt.
export function ersetzeOffenePunkte(punkte: OffenerPunkt[], herkunft: PunktHerkunft, texte: string[], newId: () => string, ergaenzen = false): OffenerPunkt[] {
  // ergaenzen: nichts entfernen, nur neue Punkte hinzufügen (z. B. wenn nur ein einzelnes Kapitel geprüft wurde)
  const behalten = ergaenzen ? punkte : punkte.filter((p) => !(p.herkunft === herkunft && !p.erledigt));
  const bekannt = new Set(behalten.map((p) => p.text.trim().toLowerCase()));
  const neu: OffenerPunkt[] = [];
  for (const roh of texte) {
    const text = roh.replace(/\s+/g, " ").trim().slice(0, L.punktText);
    if (!text || bekannt.has(text.toLowerCase())) continue;
    bekannt.add(text.toLowerCase());
    neu.push({ id: newId(), text, herkunft, erledigt: false });
  }
  return [...behalten, ...neu].slice(0, L.maxPunkte);
}
