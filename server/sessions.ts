// 모의 주문 서버: 세션 저장·불러오기·버튼 처리
import { createSession, reduce } from '../shared/reducer';
import type { Actor, SessionState, StoreId } from '../shared/types';
import { todayKey } from './adaptService';
import { HttpError } from './http';
import type { KV } from './kv';

export const SESSION_TTL = 30 * 60; // 30분 뒤 자동 삭제
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newId(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Z2-9]{6}$/.test(id);
}

export async function createNew(kv: KV, store: StoreId): Promise<SessionState> {
  for (let i = 0; i < 5; i++) {
    const id = newId();
    if (await kv.get(`s:${id}`)) continue;
    const st = createSession(id, store);
    await kv.set(`s:${id}`, st, SESSION_TTL);
    return st;
  }
  throw new HttpError(503, '세션을 만들 수 없어요');
}

export async function load(kv: KV, id: string): Promise<SessionState> {
  const st = await kv.get<SessionState>(`s:${id}`);
  if (!st) throw new HttpError(404, '연결이 끝났어요');
  return st;
}

export async function act(kv: KV, id: string, ref: string, actor: Actor): Promise<{ state: SessionState; error?: string }> {
  const st = await load(kv, id);
  let orderNo: string | undefined;
  if (ref.startsWith('pay:')) {
    const n = await kv.incr(`orderno:${todayKey()}`, 60 * 60 * 48);
    orderNo = String(100 + (n % 900));
  }
  const r = reduce(st, ref, actor, { orderNo: orderNo ? () => orderNo! : undefined });
  if (r.changed) await kv.set(`s:${id}`, r.state, SESSION_TTL);
  return { state: r.state, error: r.error };
}
