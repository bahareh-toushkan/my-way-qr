// 저장소: Vercel에 연결한 Upstash Redis(REST). 환경변수가 없으면 로컬 개발용 메모리 저장소.
import { Redis } from '@upstash/redis';

export interface KV {
  readonly kind: 'redis' | 'memory';
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
  /** 값을 1 올리고 처음 만들 때만 만료 시간을 건다 */
  incr(key: string, ttlSec: number): Promise<number>;
  pushCapped(key: string, value: unknown, cap: number, ttlSec: number): Promise<void>;
  list<T>(key: string, limit: number): Promise<T[]>;
}

class MemoryKV implements KV {
  readonly kind = 'memory' as const;
  private m = new Map<string, { v: unknown; exp: number }>();
  private alive(key: string) {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.m.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T>(key: string) {
    const e = this.alive(key);
    return e ? (structuredClone(e.v) as T) : null;
  }
  async set(key: string, value: unknown, ttlSec: number) {
    this.m.set(key, { v: structuredClone(value), exp: Date.now() + ttlSec * 1000 });
  }
  async incr(key: string, ttlSec: number) {
    const e = this.alive(key);
    const n = (typeof e?.v === 'number' ? e.v : 0) + 1;
    this.m.set(key, { v: n, exp: e ? e.exp : Date.now() + ttlSec * 1000 });
    return n;
  }
  async pushCapped(key: string, value: unknown, cap: number, ttlSec: number) {
    const e = this.alive(key);
    const arr = Array.isArray(e?.v) ? (e!.v as unknown[]) : [];
    arr.unshift(structuredClone(value));
    this.m.set(key, { v: arr.slice(0, cap), exp: Date.now() + ttlSec * 1000 });
  }
  async list<T>(key: string, limit: number) {
    const e = this.alive(key);
    return (Array.isArray(e?.v) ? (e!.v as T[]) : []).slice(0, limit);
  }
}

class RedisKV implements KV {
  readonly kind = 'redis' as const;
  constructor(private r: Redis) {}
  async get<T>(key: string) {
    return (await this.r.get<T>(key)) ?? null;
  }
  async set(key: string, value: unknown, ttlSec: number) {
    await this.r.set(key, value, { ex: ttlSec });
  }
  async incr(key: string, ttlSec: number) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, ttlSec);
    return n;
  }
  async pushCapped(key: string, value: unknown, cap: number, ttlSec: number) {
    await this.r.lpush(key, value);
    await this.r.ltrim(key, 0, cap - 1);
    await this.r.expire(key, ttlSec);
  }
  async list<T>(key: string, limit: number) {
    return (await this.r.lrange<T>(key, 0, limit - 1)) ?? [];
  }
}

let kv: KV | null = null;

export function getKV(): KV {
  if (kv) return kv;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  kv = url && token ? new RedisKV(new Redis({ url, token })) : new MemoryKV();
  return kv;
}

/** 테스트용: 새 메모리 저장소로 교체 */
export function resetKVForTests(): KV {
  kv = new MemoryKV();
  return kv;
}
