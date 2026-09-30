import { Redis } from "@upstash/redis";
import type { CodeRecord, CodeStore } from "./types";

const codeKey = (hash: string) => `code:${hash}`;

export class RedisStore implements CodeStore {
  constructor(private redis: Redis) {}

  async create(hash: string, r: CodeRecord) {
    await this.redis.hset(codeKey(hash), {
      name: r.name,
      budgetMicro: r.budgetMicro,
      costMicro: r.costMicro,
      requests: r.requests,
      active: r.active ? 1 : 0,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt ?? 0,
    });
    await this.redis.sadd("codes", hash);
  }

  async get(hash: string): Promise<CodeRecord | null> {
    const d = await this.redis.hgetall<Record<string, string | number>>(codeKey(hash));
    if (!d || Object.keys(d).length === 0) return null;
    return {
      name: String(d.name),
      budgetMicro: Number(d.budgetMicro),
      costMicro: Number(d.costMicro),
      requests: Number(d.requests),
      active: Number(d.active) === 1,
      createdAt: Number(d.createdAt),
      lastUsedAt: Number(d.lastUsedAt) || null,
    };
  }

  async addUsage(hash: string, costMicro: number, now: number) {
    const p = this.redis.pipeline();
    p.hincrby(codeKey(hash), "costMicro", Math.round(costMicro));
    p.hincrby(codeKey(hash), "requests", 1);
    p.hset(codeKey(hash), { lastUsedAt: now });
    await p.exec();
  }

  async incrDaily(hash: string, dayKey: string) {
    const key = `daily:${hash}:${dayKey}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 60 * 60 * 26);
    return n;
  }
}
