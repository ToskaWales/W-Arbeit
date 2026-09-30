export interface CodeRecord {
  name: string;
  budgetMicro: number;
  costMicro: number;
  requests: number;
  active: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface CodePatch {
  name?: string;
  active?: boolean;
  addBudgetMicro?: number;
}

// Gespeichert werden nur Code-Hash, Name und Zahlen. Nie Inhalte.
export interface CodeStore {
  create(hash: string, record: CodeRecord): Promise<void>;
  get(hash: string): Promise<CodeRecord | null>;
  list(): Promise<Array<{ hash: string; record: CodeRecord }>>;
  update(hash: string, patch: CodePatch): Promise<CodeRecord | null>;
  addUsage(hash: string, costMicro: number, now: number): Promise<void>;
  // Erhöht den Tageszähler und gibt den neuen Stand zurück.
  incrDaily(hash: string, dayKey: string): Promise<number>;
  // Allgemeiner Zähler mit Ablaufzeit (z. B. fehlgeschlagene Admin-Logins).
  bumpCounter(key: string, ttlSeconds: number): Promise<number>;
}
