// AI가 만든 화면 검증기: 기능(버튼 1:1), 사실(가격·알레르기), 언어, 화면 규칙을 검사한다.
// hard = 주문 기능이나 사실이 틀릴 수 있는 문제 → 사용하지 않고 재시도/대체
// soft = 렌더러가 보정할 수 있는 규칙 위반 → 사용하되 기록
import { constraintsFor } from './profile';
import type { AdaptedItem, AdaptedScreen, Priority, Profile, SourceScreen, ValidationIssue, ValidationResult } from './types';

const PRIORITIES: Priority[] = ['primary', 'normal', 'secondary'];

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

/** 스키마 검사 + 빈 선택 필드 보정. 필수 구조가 깨졌으면 null */
function coerce(raw: unknown, issues: ValidationIssue[]): AdaptedScreen | null {
  const hard = (message: string) => issues.push({ code: 'E_SCHEMA', severity: 'hard', message });
  if (!raw || typeof raw !== 'object') {
    hard('응답이 객체가 아님');
    return null;
  }
  const o = raw as Record<string, unknown>;
  const layoutRaw = (o.layout && typeof o.layout === 'object' ? o.layout : {}) as Record<string, unknown>;
  const columns = int(layoutRaw.columns);
  const itemsPerPage = int(layoutRaw.itemsPerPage);
  if (columns === null || columns < 1 || itemsPerPage === null || itemsPerPage < 1) {
    hard('layout.columns / layout.itemsPerPage가 올바른 숫자가 아님');
    return null;
  }
  if (!Array.isArray(o.sections) || o.sections.length === 0) {
    hard('sections가 비어 있음');
    return null;
  }
  const sections = [];
  for (const sRaw of o.sections) {
    if (!sRaw || typeof sRaw !== 'object') {
      hard('section이 객체가 아님');
      return null;
    }
    const so = sRaw as Record<string, unknown>;
    if (!Array.isArray(so.items)) {
      hard('section.items가 배열이 아님');
      return null;
    }
    const items: AdaptedItem[] = [];
    for (const iRaw of so.items) {
      const io = (iRaw && typeof iRaw === 'object' ? iRaw : {}) as Record<string, unknown>;
      const ref = str(io.ref);
      const label = str(io.label);
      if (ref === null || label === null) {
        hard('item에 ref 또는 label이 없음');
        return null;
      }
      const pr = str(io.priority);
      items.push({
        ref,
        label,
        hint: str(io.hint) ?? '',
        speech: str(io.speech) ?? '',
        icon: str(io.icon) ?? '',
        priority: pr && (PRIORITIES as string[]).includes(pr) ? (pr as Priority) : 'normal',
      });
    }
    sections.push({ title: str(so.title) ?? '', speech: str(so.speech) ?? '', items });
  }
  return {
    title: str(o.title) ?? '',
    guide: str(o.guide) ?? '',
    speech: str(o.speech) ?? '',
    layout: { columns, itemsPerPage },
    sections,
  };
}

// ---- 언어(문자 체계) 검사 ----
const RE = {
  hangul: /[가-힣ㄱ-ㆎ]/g,
  han: /[一-鿿㐀-䶿]/g,
  arabic: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g,
  latin: /[A-Za-zÀ-ɏḀ-ỿ]/g,
};

function count(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

export function scriptShares(text: string) {
  const h = count(text, RE.hangul);
  const z = count(text, RE.han);
  const a = count(text, RE.arabic);
  const l = count(text, RE.latin);
  const total = h + z + a + l || 1;
  return { hangul: h / total, han: z / total, arabic: a / total, latin: l / total, letters: h + z + a + l };
}

/** 번역된 메뉴 뒤 괄호 속 한국어 원래 이름(직원에게 보여 주기용)은 언어 판정에서 뺀다 */
const BRACKETED_HANGUL = /[(\[（【][^)\]）】]*[가-힣][^)\]）】]*[)\]）】]/g;

function langOk(rawText: string, lang: Profile['lang']): boolean {
  const text = lang === 'ko' ? rawText : rawText.replace(BRACKETED_HANGUL, ' ');
  const s = scriptShares(text);
  if (s.letters === 0) return false;
  switch (lang) {
    case 'ko':
      return s.hangul >= 0.5;
    case 'en':
    case 'vi':
      return s.latin >= 0.6 && s.hangul <= 0.3;
    case 'zh':
      return s.han >= 0.5 && s.hangul <= 0.3;
    case 'fa':
      return s.arabic >= 0.5 && s.hangul <= 0.3;
  }
}

// ---- 가격 문구 금지 (가격은 렌더러가 실제 데이터로 표시) ----
const PRICE_RE = /[0-9۰-۹٠-٩][0-9۰-۹٠-٩,.\s]*(원|₩|won|krw|đ|vnd|元|块|تومان|ریال)|₩\s*[0-9]|\$\s*[0-9]/i;

// ---- 알레르기 언급 검사 (ko/en). 원래 데이터에 없는 알레르기 성분을 '들어 있다'고 말하면 hard ----
const ALLERGEN_TERMS: Record<string, { ko: RegExp; en: RegExp }> = {
  우유: { ko: /우유|밀크|유제품/g, en: /\bmilk\b|\bdairy\b/gi },
  대두: { ko: /대두|(?<!땅)콩(?!나물)/g, en: /\bsoy(?:bean)?s?\b/gi },
  밀: { ko: /밀가루|(?<![가-힣])밀(?![가-힣])|(?<![가-힣])밀(?=[이을과와도로])/g, en: /\bwheat\b|\bgluten\b/gi },
  계란: { ko: /계란|달걀/g, en: /\beggs?\b/gi },
  돼지고기: { ko: /돼지/g, en: /\bpork\b/gi },
  쇠고기: { ko: /쇠고기|소고기/g, en: /\bbeef\b/gi },
  땅콩: { ko: /땅콩/g, en: /\bpeanuts?\b/gi },
  새우: { ko: /새우/g, en: /\bshrimps?\b|\bprawns?\b/gi },
};

const NEG_AFTER_KO = /^.{0,8}?(없|안 |않|빼|아니|무첨가)/;
const NEG_BEFORE_KO = /(무|논|노)$/;
const NEG_BEFORE_EN = /(\bno|\bwithout|\bnon-?|\bzero)\s*$/i;
const NEG_AFTER_EN = /^(-free|\s+free|\s*-?\s*free)/i;

function mentionedAllergens(text: string, lang: 'ko' | 'en'): Set<string> {
  const found = new Set<string>();
  for (const [name, re] of Object.entries(ALLERGEN_TERMS)) {
    const r = new RegExp(re[lang].source, re[lang].flags.includes('g') ? re[lang].flags : re[lang].flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 10), m.index);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
      const negated =
        lang === 'ko' ? NEG_AFTER_KO.test(after) || NEG_BEFORE_KO.test(before) : NEG_BEFORE_EN.test(before) || NEG_AFTER_EN.test(after);
      if (!negated) found.add(name);
      if (m[0].length === 0) r.lastIndex++;
    }
  }
  return found;
}

function len(s: string): number {
  return [...s].length;
}

export interface ValidateOutput {
  result: ValidationResult;
  spec: AdaptedScreen | null;
}

export function validateAdapted(raw: unknown, source: SourceScreen, profile: Profile): ValidateOutput {
  const issues: ValidationIssue[] = [];
  const spec = coerce(raw, issues);
  if (!spec) return { result: summarize(issues), spec: null };

  const c = constraintsFor(profile);
  const byRef = new Map(source.elements.map((e) => [e.ref, e]));
  const seen = new Map<string, number>();
  const items = spec.sections.flatMap((s) => s.items);

  for (const it of items) {
    seen.set(it.ref, (seen.get(it.ref) ?? 0) + 1);
    if (!byRef.has(it.ref)) issues.push({ code: 'E_UNKNOWN_REF', severity: 'hard', message: `원래 화면에 없는 버튼: ${it.ref}`, ref: it.ref });
    if (!it.label.trim()) issues.push({ code: 'E_EMPTY_LABEL', severity: 'hard', message: '버튼 이름이 비어 있음', ref: it.ref });
  }
  for (const [ref, n] of seen) {
    if (n > 1) issues.push({ code: 'E_DUP_REF', severity: 'hard', message: `같은 버튼이 ${n}번 나옴: ${ref}`, ref });
  }
  for (const e of source.elements) {
    if (e.required && !seen.has(e.ref)) issues.push({ code: 'E_MISSING_REF', severity: 'hard', message: `빠진 버튼: ${e.ref} (${e.label})`, ref: e.ref });
  }

  // 가격 문구
  const texts: { where: string; text: string; ref?: string }[] = [
    { where: 'title', text: spec.title },
    { where: 'guide', text: spec.guide },
    { where: 'speech', text: spec.speech },
    ...spec.sections.flatMap((s) => [
      { where: 'section.title', text: s.title },
      { where: 'section.speech', text: s.speech },
    ]),
    ...items.flatMap((i) => [
      { where: 'label', text: i.label, ref: i.ref },
      { where: 'hint', text: i.hint, ref: i.ref },
      { where: 'item.speech', text: i.speech, ref: i.ref },
    ]),
  ];
  for (const t of texts) {
    if (PRICE_RE.test(t.text)) {
      issues.push({ code: 'E_PRICE_TEXT', severity: 'hard', message: `가격을 직접 씀 (${t.where}): "${t.text}"`, ref: t.ref });
    }
  }

  // 자리표시자 ({orderNo})
  const whole = texts.map((t) => t.text).join('\n');
  for (const ph of source.placeholders) {
    if (!whole.includes(ph)) issues.push({ code: 'E_PLACEHOLDER', severity: 'hard', message: `${ph}가 빠짐` });
  }

  // 언어
  const langText = [spec.title, spec.guide, ...items.map((i) => `${i.label} ${i.hint}`)].join(' ');
  if (!langOk(langText, profile.lang)) {
    issues.push({ code: 'E_LANG', severity: 'hard', message: `출력 언어가 ${profile.lang}가 아님` });
  }

  // 알레르기 (ko/en만 자동 검사)
  if (profile.lang === 'ko' || profile.lang === 'en') {
    for (const it of items) {
      const el = byRef.get(it.ref);
      if (!el || el.kind !== 'item') continue;
      const said = mentionedAllergens(`${it.label} ${it.hint} ${it.speech}`, profile.lang);
      for (const a of said) {
        if (!(el.allergens ?? []).includes(a)) {
          issues.push({ code: 'E_ALLERGEN', severity: 'hard', message: `원래 데이터에 없는 알레르기 성분 언급: ${a}`, ref: it.ref });
        }
      }
    }
  }

  // ---- soft: 화면 규칙 ----
  if (spec.layout.columns > c.maxColumns) {
    issues.push({ code: 'S_COLUMNS', severity: 'soft', message: `열 수 ${spec.layout.columns} > 허용 ${c.maxColumns}` });
  }
  if (spec.layout.itemsPerPage > c.maxItemsPerPage) {
    issues.push({ code: 'S_PAGE', severity: 'soft', message: `한 화면 항목 ${spec.layout.itemsPerPage} > 허용 ${c.maxItemsPerPage}` });
  }
  for (const it of items) {
    if (len(it.label) > c.labelMax) issues.push({ code: 'S_LABEL_LONG', severity: 'soft', message: `버튼 이름이 김 (${len(it.label)}자)`, ref: it.ref });
    if (len(it.hint) > c.hintMax) issues.push({ code: 'S_HINT_LONG', severity: 'soft', message: `설명이 김 (${len(it.hint)}자)`, ref: it.ref });
    const el = byRef.get(it.ref);
    if (profile.detail === 'step' && el && (el.kind === 'item' || el.kind === 'option') && !it.hint.trim()) {
      issues.push({ code: 'S_HINT_MISSING', severity: 'soft', message: '단계 설명 모드인데 설명이 없음', ref: it.ref });
    }
    if (profile.voice && !it.speech.trim()) {
      issues.push({ code: 'S_SPEECH_MISSING', severity: 'soft', message: '읽어 주기 문장이 없음', ref: it.ref });
    }
  }
  if (profile.voice && !spec.speech.trim()) issues.push({ code: 'S_SPEECH_MISSING', severity: 'soft', message: '화면 읽어 주기 문장이 없음' });

  return { result: summarize(issues), spec };
}

function summarize(issues: ValidationIssue[]): ValidationResult {
  const hardCount = issues.filter((i) => i.severity === 'hard').length;
  return { ok: hardCount === 0, hardCount, softCount: issues.length - hardCount, issues };
}
