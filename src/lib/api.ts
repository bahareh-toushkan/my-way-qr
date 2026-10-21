// 브라우저 → 서버 API 호출
import type { Actor, AdaptResponse, MetricRecord, Profile, ScreenKey, SessionState, StoreId } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 15_000);
  try {
    const res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`, body);
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, ctrl.signal.aborted ? '시간 초과' : '네트워크 오류');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  createSession: (store: StoreId) => call<{ state: SessionState }>('/api/session', { method: 'POST', body: JSON.stringify({ store }) }),
  getSession: (id: string) => call<{ state: SessionState }>(`/api/session?s=${encodeURIComponent(id)}`),
  action: async (id: string, ref: string, actor: Actor) => {
    try {
      return await call<{ state: SessionState; error?: string }>('/api/action', { method: 'POST', body: JSON.stringify({ s: id, ref, actor }) });
    } catch (e) {
      // 409 = 지금 할 수 없는 버튼 (상태는 함께 돌아온다)
      if (e instanceof ApiError && e.status === 409 && e.body) return e.body as { state: SessionState; error?: string };
      throw e;
    }
  },
  adapt: (store: StoreId, screenKey: ScreenKey, profile: Profile, opts: { noCache?: boolean; evalKey?: string } = {}) =>
    call<AdaptResponse>('/api/adapt', {
      method: 'POST',
      body: JSON.stringify({ store, screenKey, profile, ...opts }),
      timeoutMs: 58_000,
    }),
  profileFromText: (text: string, profile: Profile) =>
    call<{ profile: Profile; reason: string; source: 'ai' | 'rules' }>('/api/profile-from-text', {
      method: 'POST',
      body: JSON.stringify({ text, profile }),
      timeoutMs: 25_000,
    }),
  metric: (rec: Omit<MetricRecord, 'at'>) => call<{ ok: boolean }>('/api/metric', { method: 'POST', body: JSON.stringify(rec) }).catch(() => ({ ok: false })),
  metrics: (key: string) => call<{ records: MetricRecord[] }>(`/api/metric?key=${encodeURIComponent(key)}`),
  health: () =>
    call<{ provider: string; model: string; storage: string; promptVersion: string; aiCallsToday: number; aiDailyLimit: number; evalKeyRequired: boolean }>(
      '/api/health',
    ),
};
