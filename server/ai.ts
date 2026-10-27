// AI 공급자: Google Gemini(REST, 구조화 JSON 출력). 로컬 테스트용 mock도 있다(측정·보고에 쓰면 안 됨).
import { getStore } from '../shared/catalog.js';
import type { AdaptedScreen, Profile, SourceScreen } from '../shared/types.js';
import { constraintsFor } from '../shared/profile.js';
import { t } from '../shared/i18n.js';

export class AiError extends Error {
  constructor(
    public kind: 'rate_limited' | 'timeout' | 'http' | 'parse' | 'blocked' | 'config',
    message: string,
  ) {
    super(message);
  }
}

export interface GenerateArgs {
  system: string;
  user: string;
  schema: object;
  timeoutMs: number;
  /** mock 전용: 어떤 화면을 만드는지 */
  mockContext?: { source: SourceScreen; profile: Profile; attempt: number };
}

export interface AiProvider {
  readonly name: 'gemini' | 'mock';
  model(): string;
  generateJson(args: GenerateArgs): Promise<unknown>;
}

// ---------------- Gemini ----------------

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;
  private models: string[];
  private active = 0;
  private thinkingOk = true;

  constructor(private key: string) {
    const preferred = (process.env.GEMINI_MODEL || '').trim();
    // 2026-10: 2.5 계열은 새 사용자에게 막힘(404) → 최신 Flash 별칭을 먼저, 그다음 이름 고정 후보
    this.models = [
      ...new Set(
        [preferred, 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean),
      ),
    ];
  }

  /** 모델 세대별 '생각' 설정: 2.x는 thinkingBudget, 3.x 이후는 thinkingLevel (빠르게 응답하도록 낮게) */
  private thinkingFor(model: string): Record<string, unknown> {
    if (!this.thinkingOk) return {};
    if (/gemini-2\./.test(model)) return { thinkingConfig: { thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET ?? 0) } };
    return { thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'low' } };
  }

  model() {
    return this.models[this.active];
  }

  async generateJson(args: GenerateArgs): Promise<unknown> {
    for (;;) {
      const model = this.models[this.active];
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: 'user', parts: [{ text: args.user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: args.schema,
          temperature: 0.4,
          maxOutputTokens: 8192,
          ...this.thinkingFor(model),
        },
      };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), args.timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (e) {
        throw new AiError(ctrl.signal.aborted ? 'timeout' : 'http', `Gemini 요청 실패: ${(e as Error).message}`);
      } finally {
        clearTimeout(timer);
      }
      const text = await res.text();
      if (res.status === 429) throw new AiError('rate_limited', 'Gemini 무료 한도 초과(429)');
      if (res.status === 404) {
        if (this.active < this.models.length - 1) {
          this.active++; // 모델 이름이 바뀌었거나 쓸 수 없음 → 다음 후보
          this.thinkingOk = true;
          continue;
        }
        throw new AiError('config', `쓸 수 있는 Gemini 모델이 없음: ${text.slice(0, 200)}`);
      }
      if (res.status === 400 && this.thinkingOk && /thinking/i.test(text)) {
        this.thinkingOk = false; // 이 모델은 thinkingConfig를 받지 않음
        continue;
      }
      if (!res.ok) throw new AiError('http', `Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new AiError('parse', 'Gemini 응답이 JSON이 아님');
      }
      const cand = data?.candidates?.[0];
      if (!cand) throw new AiError('blocked', `Gemini가 응답하지 않음: ${JSON.stringify(data?.promptFeedback ?? {}).slice(0, 200)}`);
      const out = (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      try {
        return JSON.parse(out);
      } catch {
        throw new AiError('parse', `출력 JSON 파싱 실패 (finishReason=${cand.finishReason})`);
      }
    }
  }
}

/** 진단용: 이 키로 쓸 수 있는 Flash 계열 모델 이름 (키는 응답에 넣지 않음) */
export async function listGeminiModels(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const res = await fetch(`${API}?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) return [`HTTP ${res.status}`];
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /flash/.test(m.name))
    .map((m) => m.name.replace(/^models\//, ''));
}

// ---------------- Mock (로컬 테스트 전용) ----------------

class MockProvider implements AiProvider {
  readonly name = 'mock' as const;
  model() {
    return 'mock-rules-v1';
  }
  async generateJson(args: GenerateArgs): Promise<unknown> {
    const ctx = args.mockContext;
    if (!ctx) throw new AiError('config', 'mock은 화면 변환에만 쓸 수 있음');
    const fail = process.env.MOCK_FAIL; // 'first' = 첫 시도만 실패, 'always' = 항상 실패
    if (fail === 'always' || (fail === 'first' && ctx.attempt === 0)) {
      return { title: 'x', guide: 'x', speech: 'x', layout: { columns: 1, itemsPerPage: 4 }, sections: [{ title: 'x', speech: 'x', items: [{ ref: 'item:does-not-exist', label: '없는 메뉴', hint: '', speech: '', icon: '', priority: 'normal' }] }] };
    }
    return mockAdapt(ctx.source, ctx.profile);
  }
}

/** 규칙으로 흉내 낸 변환 (ko/en만 의미 있음). 화면 흐름 테스트용. */
function mockAdapt(source: SourceScreen, profile: Profile): AdaptedScreen {
  const c = constraintsFor(profile);
  const ko = profile.lang !== 'en';
  const store = getStore(source.store);
  const groups = new Map<string, typeof source.elements>();
  for (const e of source.elements) {
    if (!e.required) continue;
    const g = e.groupLabel ?? (ko ? '버튼' : 'Buttons');
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }
  const sections = [...groups.entries()].map(([title, els]) => ({
    title: ko ? title : els[0].group ? store.categories.find((x) => x.id === els[0].group)?.labelEn ?? store.groups.find((x) => x.id === els[0].group)?.labelEn ?? title : 'Buttons',
    speech: title,
    items: els.map((e) => {
      const label = ko ? e.label : e.labelEn;
      const hint = profile.detail === 'step' && ko && e.desc ? e.desc : '';
      return {
        ref: e.ref,
        label,
        hint,
        speech: hint ? `${label}. ${hint}` : label,
        icon: store.items.find((i) => `item:${i.id}` === e.ref)?.icon ?? '',
        priority: (['add', 'checkout', 'nav:cart', 'new'].includes(e.ref) ? 'primary' : 'normal') as 'primary' | 'normal',
      };
    }),
  }));
  const guide = t(ko ? 'ko' : 'en').guides[source.screenKey];
  return {
    title: ko ? store.name : store.nameEn,
    guide,
    speech: guide,
    layout: { columns: c.maxColumns, itemsPerPage: c.maxItemsPerPage },
    sections,
  };
}

let provider: AiProvider | null | undefined;

/** 설정에 맞는 공급자. 키도 mock 설정도 없으면 null (→ 규칙 기반 화면) */
export function getProvider(): AiProvider | null {
  if (provider !== undefined) return provider;
  if (process.env.AI_PROVIDER === 'mock') provider = new MockProvider();
  else if (process.env.GEMINI_API_KEY) provider = new GeminiProvider(process.env.GEMINI_API_KEY);
  else provider = null;
  return provider;
}

export function setProviderForTests(p: AiProvider | null | undefined) {
  provider = p;
}
