// Euro-Beträge aus Cent darstellen und Eingaben in Euro lesen. Läuft im Browser und auf dem Server.

// Unter einem Euro mit drei Nachkommastellen, damit kleine Beträge (einzelne Anfragen) sichtbar bleiben.
export function formatEuro(cents: number): string {
  const euro = cents / 100;
  const digits = Math.abs(euro) < 1 ? 3 : 2;
  return `${euro.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
}

// "5", "5,50" oder "5.5" in Euro zu Cent. Ungültiges ergibt null.
export function euroToCents(input: string): number | null {
  const t = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 ? cents : null;
}
