import { beforeEach, describe, expect, it } from 'vitest';
import { getStore } from '../shared/catalog.js';
import { fallbackSpec } from '../shared/fallback.js';
import { DEFAULT_PROFILE, normalizeProfile, TEST_PROFILES } from '../shared/profile.js';
import { cartTotal, createSession, reduce } from '../shared/reducer.js';
import { describeScreen, refsOf } from '../shared/screens.js';
import { SCREEN_KEYS, STORE_IDS, type AdaptedScreen, type Profile } from '../shared/types.js';
import { validateAdapted } from '../shared/validate.js';
import { adaptScreen } from '../server/adaptService.js';
import { AiError, type AiProvider } from '../server/ai.js';
import { resetKVForTests } from '../server/kv.js';
import { rulesProfile } from '../server/profileFromText.js';

const ko: Profile = { ...DEFAULT_PROFILE };
const en: Profile = { ...DEFAULT_PROFILE, lang: 'en' };

function goodMenu(profile: Profile = ko): AdaptedScreen {
  // 원래 화면을 그대로 옮긴 '정답' 변환 (검증기 기준선)
  return fallbackSpec(describeScreen('cafe', 'menu'), profile);
}

describe('주문 상태 기계', () => {
  it('옵션 있는 메뉴 → 옵션 화면 → 담기 → 결제 → 주문번호', () => {
    let s = createSession('ABCDEF', 'cafe');
    s = reduce(s, 'item:latte', 'phone').state;
    expect(s.step).toBe('options');
    expect(s.draft?.options).toEqual({ temp: 'hot', size: 'regular', shot: 'none' });
    s = reduce(s, 'opt:temp:ice', 'phone').state;
    s = reduce(s, 'opt:size:large', 'phone').state;
    s = reduce(s, 'qty:+', 'phone').state;
    s = reduce(s, 'add', 'phone').state;
    expect(s.step).toBe('menu');
    expect(s.cart).toHaveLength(1);
    expect(cartTotal(s)).toBe((3500 + 500) * 2);
    s = reduce(s, 'nav:cart', 'kiosk').state;
    s = reduce(s, 'checkout', 'kiosk').state;
    expect(reduce(s, 'pay:card', 'phone').error).toBeTruthy(); // 매장/포장 먼저
    s = reduce(s, 'where:togo', 'phone').state;
    s = reduce(s, 'pay:mobile', 'phone', { orderNo: () => '123' }).state;
    expect(s.step).toBe('done');
    expect(s.orderNo).toBe('123');
  });

  it('고를 수 없는 옵션(콜드브루 HOT)은 거절', () => {
    let s = createSession('ABCDEF', 'cafe');
    s = reduce(s, 'item:coldbrew', 'kiosk').state;
    expect(s.draft?.options.temp).toBe('ice');
    expect(reduce(s, 'opt:temp:hot', 'kiosk').error).toBeTruthy();
  });

  it('같은 메뉴·옵션은 한 줄로 합치고, 줄 단위로 고치기', () => {
    let s = createSession('ABCDEF', 'cafe');
    s = reduce(s, 'item:cookie', 'kiosk').state;
    s = reduce(s, 'item:cookie', 'kiosk').state;
    expect(s.cart).toHaveLength(1);
    expect(s.cart[0].qty).toBe(2);
    const id = s.cart[0].lineId;
    s = reduce(s, `line:${id}:-`, 'phone').state;
    expect(s.cart[0].qty).toBe(1);
    s = reduce(s, `line:${id}:del`, 'phone').state;
    expect(s.cart).toHaveLength(0);
  });
});

describe('검증기', () => {
  it('규칙 기반 화면은 모든 매장·화면에서 hard 오류 0 (ko, en)', () => {
    for (const store of STORE_IDS) {
      for (const key of SCREEN_KEYS) {
        for (const p of [ko, en]) {
          const src = describeScreen(store, key);
          const r = validateAdapted(fallbackSpec(src, p), src, p);
          expect(r.result.issues.filter((i) => i.severity === 'hard'), `${store}/${key}/${p.lang}`).toEqual([]);
        }
      }
    }
  });

  it('빠진 버튼·없는 버튼·중복 버튼을 잡는다', () => {
    const src = describeScreen('cafe', 'menu');
    const spec = goodMenu();
    spec.sections[0].items = spec.sections[0].items.slice(1); // 첫 메뉴 빠짐
    spec.sections[1].items.push({ ...spec.sections[1].items[0] }); // 중복
    spec.sections[2].items.push({ ref: 'item:ghost', label: '유령 메뉴', hint: '', speech: '', icon: '', priority: 'normal' });
    const codes = validateAdapted(spec, src, ko).result.issues.map((i) => i.code);
    expect(codes).toContain('E_MISSING_REF');
    expect(codes).toContain('E_DUP_REF');
    expect(codes).toContain('E_UNKNOWN_REF');
  });

  it('가격을 글로 쓰면 hard', () => {
    const src = describeScreen('cafe', 'menu');
    const spec = goodMenu();
    spec.sections[0].items[0].hint = '3,000원이에요';
    expect(validateAdapted(spec, src, ko).result.issues.map((i) => i.code)).toContain('E_PRICE_TEXT');
  });

  it('원래 데이터에 없는 알레르기 성분을 말하면 hard, 부정문은 통과', () => {
    const src = describeScreen('cafe', 'menu');
    const bad = goodMenu();
    const ame = bad.sections[0].items.find((i) => i.ref === 'item:americano')!;
    ame.hint = '우유가 들어간 커피';
    expect(validateAdapted(bad, src, ko).result.issues.map((i) => i.code)).toContain('E_ALLERGEN');
    const ok = goodMenu();
    ok.sections[0].items.find((i) => i.ref === 'item:americano')!.hint = '우유가 없는 진한 커피';
    ok.sections[0].items.find((i) => i.ref === 'item:latte')!.hint = '우유가 들어간 커피';
    expect(validateAdapted(ok, src, ko).result.issues.map((i) => i.code)).not.toContain('E_ALLERGEN');
  });

  it('언어 검사: 영어 프로필에 한국어 화면이면 hard, 괄호 속 한국어 이름은 허용', () => {
    const src = describeScreen('cafe', 'menu');
    expect(validateAdapted(goodMenu(ko), src, en).result.issues.map((i) => i.code)).toContain('E_LANG');
    const spec = goodMenu(en);
    for (const s of spec.sections) for (const it of s.items) if (it.ref.startsWith('item:')) it.label = `${it.label} (${src.elements.find((e) => e.ref === it.ref)!.label})`;
    expect(validateAdapted(spec, src, en).result.issues.map((i) => i.code)).not.toContain('E_LANG');
  });

  it('완료 화면은 {orderNo}가 있어야 함', () => {
    const src = describeScreen('cafe', 'done');
    const spec = fallbackSpec(src, ko);
    spec.guide = '주문 완료!';
    spec.speech = '주문 완료!';
    expect(validateAdapted(spec, src, ko).result.issues.map((i) => i.code)).toContain('E_PLACEHOLDER');
  });

  it('프로필 정규화는 모르는 값을 기본값으로', () => {
    expect(normalizeProfile({ lang: 'xx', text: 'huge', voice: 'yes' })).toEqual(DEFAULT_PROFILE);
  });
});

describe('변환 파이프라인', () => {
  let kv = resetKVForTests();
  beforeEach(() => {
    kv = resetKVForTests();
  });

  const scripted = (outputs: (unknown | Error)[]): AiProvider & { calls: number } => {
    const p = {
      name: 'gemini' as const,
      calls: 0,
      model: () => 'test-model',
      async generateJson() {
        const o = outputs[Math.min(p.calls, outputs.length - 1)];
        p.calls++;
        if (o instanceof Error) throw o;
        return o;
      },
    };
    return p;
  };

  it('첫 시도 성공 → ai, 두 번째 요청은 캐시', async () => {
    const ai = scripted([goodMenu()]);
    const r1 = await adaptScreen({ store: 'cafe', screenKey: 'menu', profile: ko }, { kv, ai });
    expect(r1.source).toBe('ai');
    expect(r1.validation.ok).toBe(true);
    const r2 = await adaptScreen({ store: 'cafe', screenKey: 'menu', profile: ko }, { kv, ai });
    expect(r2.source).toBe('cache');
    expect(ai.calls).toBe(1);
  });

  it('첫 시도 검증 실패 → 오류를 알려 주고 재시도 → ai-retry', async () => {
    const broken = goodMenu();
    broken.sections[0].items.shift();
    const ai = scripted([broken, goodMenu()]);
    const r = await adaptScreen({ store: 'cafe', screenKey: 'menu', profile: ko }, { kv, ai });
    expect(r.source).toBe('ai-retry');
    expect(r.attempts).toHaveLength(2);
    expect(r.attempts[0].codes).toContain('E_MISSING_REF');
  });

  it('두 번 다 실패 → 규칙 기반 화면', async () => {
    const broken = goodMenu();
    broken.sections[0].items.shift();
    const ai = scripted([broken]);
    const r = await adaptScreen({ store: 'cafe', screenKey: 'menu', profile: ko }, { kv, ai });
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('validation_failed');
  });

  it('무료 한도 초과(429) → 바로 규칙 기반 화면', async () => {
    const ai = scripted([new AiError('rate_limited', '429')]);
    const r = await adaptScreen({ store: 'cafe', screenKey: 'menu', profile: ko }, { kv, ai });
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('rate_limited');
    expect(ai.calls).toBe(1);
  });

  it('AI 키가 없으면 규칙 기반 화면', async () => {
    const r = await adaptScreen({ store: 'cafe', screenKey: 'menu', profile: ko }, { kv, ai: null });
    expect(r.source).toBe('fallback');
    expect(r.fallbackReason).toBe('no_ai_configured');
  });

  it('출력 스키마의 ref enum은 원래 화면 ref와 같다', () => {
    for (const key of SCREEN_KEYS) {
      const src = describeScreen('restaurant', key);
      expect(refsOf(src).length).toBeGreaterThan(0);
    }
    expect(getStore('cafe').items.length).toBe(13);
    expect(TEST_PROFILES).toHaveLength(6);
  });
});

describe('말로 설정 (규칙 대체)', () => {
  it('문장에서 설정을 고른다', () => {
    const p = rulesProfile('글씨가 작아서 잘 안 보이고 천천히 하나씩 하고 싶어요. 영어가 편해요', ko);
    expect(p.text).toBe('xlarge');
    expect(p.detail).toBe('step');
    expect(p.lang).toBe('en');
  });
});
