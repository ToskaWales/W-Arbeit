// Prüft vor dem Go-live, ob die Betreiberangaben für Impressum und Datenschutz gesetzt sind.
// Nutzung: npm run check:legal   (liest .env.local; auf Vercel dieselben Variablen unter Settings eintragen)
import { getLegalInfo, hasPlaceholders } from "../src/config/legal";

const info = getLegalInfo();
if (hasPlaceholders(info)) {
  console.error("Betreiberangaben unvollständig. Setze LEGAL_NAME, LEGAL_ADDRESS, LEGAL_EMAIL und UPSTASH_REGION.");
  process.exit(1);
}
console.log("Betreiberangaben vollständig:", info.name, "|", info.addressLines.join(", "), "|", info.email);
