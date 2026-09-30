export interface CodeRecord {
  name: string;
  budgetMicro: number;
  costMicro: number;
  requests: number;
  active: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}

// Gespeichert werden nur Code-Hash, Name und Zahlen. Nie Inhalte.
export interface CodeStore {
  create(hash: string, record: CodeRecord): Promise<void>;
  get(hash: string): Promise<CodeRecord | null>;
  addUsage(hash: string, costMicro: number, now: number): Promise<void>;
  // Erhöht den Tageszähler und gibt den neuen Stand zurück.
  incrDaily(hash: string, dayKey: string): Promise<number>;
}
