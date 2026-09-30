// Aufschlag auf die echten API-Kosten, den der Betreiber als Gewinn einrechnet (in Prozent der echten Kosten).
// Schüler sehen und bezahlen nur den verrechneten Betrag (echte Kosten + Aufschlag), nie die echten Kosten.
export const MARKUP_PERCENT = 10;

// Anthropic rechnet in US-Dollar ab, das Guthaben der Schüler ist in Euro.
// Standardkurs: EZB-Referenzkurs vom 29.09.2026 (1 Euro = 1,1355 US-Dollar), also 1 US-Dollar = 0,8807 Euro.
// Ändern ohne Code: Umgebungsvariable USD_EUR_RATE (Euro pro US-Dollar, z. B. 0.88). Gilt für neue Buchungen.
export const USD_EUR_DEFAULT = 0.8807;

export function usdToEur(env: Record<string, string | undefined> = process.env): number {
  const v = Number(env.USD_EUR_RATE);
  return Number.isFinite(v) && v > 0.3 && v < 3 ? v : USD_EUR_DEFAULT;
}
