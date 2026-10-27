// 화면 변환 파이프라인: 캐시 → 하루 한도 확인 → AI 변환 → 검증 → (실패 시) 오류를 알려 주고 1번 재시도 → 규칙 기반 대체
import { fallbackSpec } from '../shared/fallback.js';
import { profileKey } from '../shared/profile.js';
import { describeScreen, refsOf } from '../shared/screens.js';
import type { AdaptResponse, AttemptLog, Profile, ScreenKey, StoreId, ValidationIssue } from '../shared/types.js';
import { validateAdapted } from '../shared/validate.js';
import { AiError, type AiProvider } from './ai.js';
import type { KV } from './kv.js';
import { adaptedSchema, buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from './prompt.js';

const CACHE_TTL = 60 * 60 * 24 * 14; // 14일
const MAX_ATTEMPTS = 2;
const TOTAL_BUDGET_MS = 45_000;
const PER_ATTEMPT_MS = 22_000;

export function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export function todayKey(now = Date.now()): string {
  // 한국 시간 기준 날짜
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

export interface AdaptInput {
  store: StoreId;
  screenKey: ScreenKey;
  profile: Profile;
  noCache?: boolean;
}

export async function adaptScreen(input: AdaptInput, deps: { kv: KV; ai: AiProvider | null; now?: () => number }): Promise<AdaptResponse> {
  const clock = deps.now ?? Date.now;
  const started = clock();
  const source = describeScreen(input.store, input.screenKey);
  const cacheKey = `ad:${PROMPT_VERSION}:${input.store}:${input.screenKey}:${profileKey(input.profile)}`;
  const providerName = deps.ai?.name ?? 'none';
  const model = deps.ai?.model() ?? 'none';

  if (!input.noCache) {
    const cached = await deps.kv.get<AdaptResponse>(cacheKey);
    if (cached) return { ...cached, source: 'cache', latencyMs: clock() - started };
  }

  const fallback = (reason: string, attempts: AttemptLog[]): AdaptResponse => {
    const spec = fallbackSpec(source, input.profile);
    const { result } = validateAdapted(spec, source, input.profile);
    return {
      spec,
      source: 'fallback',
      provider: providerName,
      model,
      validation: result,
      attempts,
      latencyMs: clock() - started,
      fallbackReason: reason,
      promptVersion: PROMPT_VERSION,
    };
  };

  if (!deps.ai) return fallback('no_ai_configured', []);

  const used = await deps.kv.incr(`aibudget:${todayKey(clock())}`, 60 * 60 * 48);
  if (used > dailyLimit()) return fallback('daily_limit', []);

  const attempts: AttemptLog[] = [];
  const schema = adaptedSchema(refsOf(source));
  let previousIssues: ValidationIssue[] | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = TOTAL_BUDGET_MS - (clock() - started);
    if (remaining < 4_000) break;
    const t0 = clock();
    try {
      const raw = await deps.ai.generateJson({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(source, input.profile, previousIssues),
        schema,
        timeoutMs: Math.min(PER_ATTEMPT_MS, remaining),
        mockContext: { source, profile: input.profile, attempt },
      });
      const { result, spec } = validateAdapted(raw, source, input.profile);
      attempts.push({
        ms: clock() - t0,
        ok: result.ok,
        hard: result.hardCount,
        soft: result.softCount,
        codes: [...new Set(result.issues.map((i) => i.code))],
      });
      if (result.ok && spec) {
        const response: AdaptResponse = {
          spec,
          source: attempt === 0 ? 'ai' : 'ai-retry',
          provider: providerName,
          model: deps.ai.model(),
          validation: result,
          attempts,
          latencyMs: clock() - started,
          promptVersion: PROMPT_VERSION,
        };
        await deps.kv.set(cacheKey, response, CACHE_TTL);
        return response;
      }
      previousIssues = result.issues.filter((i) => i.severity === 'hard');
    } catch (e) {
      const err = e as Error;
      attempts.push({ ms: clock() - t0, ok: false, hard: 0, soft: 0, codes: [], error: err.message.slice(0, 200) });
      if (e instanceof AiError && (e.kind === 'rate_limited' || e.kind === 'config')) {
        return fallback(e.kind, attempts);
      }
    }
  }
  return fallback('validation_failed', attempts);
}
