export interface CodeRecord {
  name: string;
  budgetMicro: number;
  costMicro: number; // ECHTE API-Kosten (nur der Admin sieht sie)
  chargedMicro: number; // verrechnet an den Schüler: echte Kosten plus Aufschlag. Das Guthaben sinkt um diesen Betrag.
  requests: number;
  active: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  hidden: boolean; // im Admin ausgeblendet (Archiv), ändert nichts am Zugang
}

export interface CodePatch {
  name?: string;
  active?: boolean;
  hidden?: boolean;
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
  getCounter(key: string): Promise<number>;
  // Sperre gegen parallele Anfragen desselben Codes. true = Sperre erhalten.
  tryLock(key: string, ttlSeconds: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
  // Verschlüsselte Datenblöcke (die Seminararbeit). Ablaufzeit wird bei jedem Schreiben erneuert.
  getBlob(key: string): Promise<string | null>;
  setBlob(key: string, value: string, ttlSeconds: number): Promise<void>;
  deleteBlob(key: string): Promise<void>;
}
