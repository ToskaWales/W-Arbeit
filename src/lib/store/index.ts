import { Redis } from "@upstash/redis";
import { RedisStore } from "./redis";
import type { CodeStore } from "./types";

let store: CodeStore | null = null;

export function getStore(): CodeStore {
  if (store) return store;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis ist nicht konfiguriert (KV_REST_API_URL / KV_REST_API_TOKEN).");
  store = new RedisStore(new Redis({ url, token }));
  return store;
}
