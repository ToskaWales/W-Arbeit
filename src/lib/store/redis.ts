import { Redis } from "@upstash/redis";
import type { CodePatch, CodeRecord, CodeStore } from "./types";

const codeKey = (hash: string) => `code:${hash}`;

function toRecord(d: Record<string, string | number> | null): CodeRecord | null {
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

  async get(hash: string) {
    return toRecord(await this.redis.hgetall<Record<string, string | number>>(codeKey(hash)));
  }

  async list() {
    const hashes = await this.redis.smembers("codes");
    if (hashes.length === 0) return [];
    const p = this.redis.pipeline();
    for (const h of hashes) p.hgetall(codeKey(h));
    const rows = (await p.exec()) as Array<Record<string, string | number> | null>;
    return hashes.flatMap((hash, i) => {
      const record = toRecord(rows[i]);
      return record ? [{ hash, record }] : [];
    });
  }

  async update(hash: string, patch: CodePatch) {
    if (!(await this.redis.exists(codeKey(hash)))) return null;
    const p = this.redis.pipeline();
    if (patch.name !== undefined) p.hset(codeKey(hash), { name: patch.name });
    if (patch.active !== undefined) p.hset(codeKey(hash), { active: patch.active ? 1 : 0 });
    if (patch.addBudgetMicro) p.hincrby(codeKey(hash), "budgetMicro", Math.round(patch.addBudgetMicro));
    await p.exec();
    return this.get(hash);
  }

  async addUsage(hash: string, costMicro: number, now: number) {
    const p = this.redis.pipeline();
    p.hincrby(codeKey(hash), "costMicro", Math.round(costMicro));
    p.hincrby(codeKey(hash), "requests", 1);
    p.hset(codeKey(hash), { lastUsedAt: now });
    await p.exec();
  }

  async incrDaily(hash: string, dayKey: string) {
    return this.bumpCounter(`daily:${hash}:${dayKey}`, 60 * 60 * 26);
  }

  async bumpCounter(key: string, ttlSeconds: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSeconds);
    return n;
  }
}
