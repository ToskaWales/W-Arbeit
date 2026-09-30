import type { CodeRecord, CodeStore } from "./types";

export class MemoryStore implements CodeStore {
  private records = new Map<string, CodeRecord>();
  private daily = new Map<string, number>();

  async create(hash: string, record: CodeRecord) {
    this.records.set(hash, { ...record });
  }
  async get(hash: string) {
    const r = this.records.get(hash);
    return r ? { ...r } : null;
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
}
