import type { CodePatch, CodeRecord, CodeStore } from "./types";

export class MemoryStore implements CodeStore {
  private records = new Map<string, CodeRecord>();
  private daily = new Map<string, number>();
  private counters = new Map<string, number>();

  async create(hash: string, record: CodeRecord) {
    this.records.set(hash, { ...record });
  }
  async get(hash: string) {
    const r = this.records.get(hash);
    return r ? { ...r } : null;
  }
  async list() {
    return [...this.records].map(([hash, r]) => ({ hash, record: { ...r } }));
  }
  async update(hash: string, patch: CodePatch) {
    const r = this.records.get(hash);
    if (!r) return null;
    if (patch.name !== undefined) r.name = patch.name;
    if (patch.active !== undefined) r.active = patch.active;
    if (patch.addBudgetMicro) r.budgetMicro += patch.addBudgetMicro;
    return { ...r };
  }
  async addUsage(hash: string, costMicro: number, now: number) {
    const r = this.records.get(hash);
    if (!r) return;
    r.costMicro += costMicro;
    r.requests += 1;
    r.lastUsedAt = now;
  }
  async incrDaily(hash: string, dayKey: string) {
    const key = `${hash}:${dayKey}`;
    const n = (this.daily.get(key) ?? 0) + 1;
    this.daily.set(key, n);
    return n;
  }
  async bumpCounter(key: string) {
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return n;
  }
  async getCounter(key: string) {
    return this.counters.get(key) ?? 0;
  }
  private locks = new Set<string>();
  async tryLock(key: string) {
    if (this.locks.has(key)) return false;
    this.locks.add(key);
    return true;
  }
  async unlock(key: string) {
    this.locks.delete(key);
  }
}
