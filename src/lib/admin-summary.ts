// Summen für die Admin-Seite. Reine Rechnung, damit sie sich testen lässt.
export interface SummaryRow {
  budgetCents: number;
  chargedCents: number;
  costCents: number;
  profitCents: number;
  restCents: number;
  requests: number;
  active: boolean;
}

export interface Summary {
  codes: number;
  requests: number;
  chargedCents: number; // verrechnet (Einnahmen aus verbrauchtem Guthaben)
  costCents: number; // echte API-Kosten
  profitCents: number;
  openCents: number; // noch nicht verbrauchtes Guthaben aktiver Codes
}

export function summarize(rows: SummaryRow[]): Summary {
  const sum = (f: (r: SummaryRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  return {
    codes: rows.length,
    requests: sum((r) => r.requests),
    chargedCents: sum((r) => r.chargedCents),
    costCents: sum((r) => r.costCents),
    profitCents: sum((r) => r.profitCents),
    openCents: sum((r) => (r.active ? Math.max(0, r.restCents) : 0)),
  };
}
