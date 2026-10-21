// '내 방식' 프로필: 정규화, 화면 제약(코드로 강제), 프롬프트용 설명, 측정용 대표 프로필
import { LANGS, type Lang, type Profile } from './types';

export const DEFAULT_PROFILE: Profile = {
  v: 1,
  lang: 'ko',
  text: 'normal',
  touch: 'normal',
  words: 'normal',
  detail: 'short',
  voice: false,
  contrast: 'normal',
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** 어떤 입력이 와도 유효한 프로필로 바꾼다 (모르는 값은 기본값) */
export function normalizeProfile(input: unknown): Profile {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    v: 1,
    lang: pick<Lang>(o.lang, LANGS, DEFAULT_PROFILE.lang),
    text: pick(o.text, ['normal', 'large', 'xlarge'] as const, DEFAULT_PROFILE.text),
    touch: pick(o.touch, ['normal', 'large'] as const, DEFAULT_PROFILE.touch),
    words: pick(o.words, ['normal', 'easy'] as const, DEFAULT_PROFILE.words),
    detail: pick(o.detail, ['short', 'step'] as const, DEFAULT_PROFILE.detail),
    voice: o.voice === true,
    contrast: pick(o.contrast, ['normal', 'high'] as const, DEFAULT_PROFILE.contrast),
  };
}

/** 캐시·기록용 짧은 키 (순서 고정) */
export function profileKey(p: Profile): string {
  return [p.lang, `t${p.text}`, `b${p.touch}`, `w${p.words}`, `d${p.detail}`, p.voice ? 'v1' : 'v0', `c${p.contrast}`].join('.');
}

export interface Constraints {
  fontScale: number;
  minTargetPx: number;
  maxColumns: number;
  maxItemsPerPage: number;
  /** 쉬운 말일 때 버튼 이름 최대 길이 (글자 수, 언어별 보정 전) */
  labelMax: number;
  hintMax: number;
}

/**
 * 제안자 답변(우선순위: 글씨 > 버튼 > 자세한 설명)에 따라 코드로 강제하는 제약.
 * AI가 어겨도 렌더러가 이 값으로 고정하고, 검증기는 '규칙 위반'으로 기록한다.
 */
export function constraintsFor(p: Profile): Constraints {
  const fontScale = p.text === 'xlarge' ? 1.75 : p.text === 'large' ? 1.35 : 1;
  let minTargetPx = p.touch === 'large' ? 72 : 48;
  if (p.text === 'xlarge') minTargetPx = Math.max(minTargetPx, 72);
  else if (p.text === 'large') minTargetPx = Math.max(minTargetPx, 60);
  const maxColumns = p.text === 'xlarge' ? 1 : 2;
  let maxItemsPerPage = p.text === 'xlarge' ? 4 : p.text === 'large' ? 6 : 12;
  if (p.detail === 'step') maxItemsPerPage = Math.min(maxItemsPerPage, 4);
  const latin = p.lang === 'en' || p.lang === 'vi';
  const labelMax = p.words === 'easy' ? (latin ? 28 : 14) : latin ? 40 : 20;
  const hintMax = p.detail === 'step' ? (latin ? 120 : 60) : latin ? 70 : 35;
  return { fontScale, minTargetPx, maxColumns, maxItemsPerPage, labelMax, hintMax };
}

export const LANG_NAMES: Record<Lang, { native: string; english: string }> = {
  ko: { native: '한국어', english: 'Korean' },
  en: { native: 'English', english: 'English' },
  zh: { native: '中文', english: 'Simplified Chinese' },
  vi: { native: 'Tiếng Việt', english: 'Vietnamese' },
  fa: { native: 'فارسی', english: 'Persian (Farsi)' },
};

/** 프롬프트에 넣을 프로필 설명 (영어 지시문) */
export function describeProfileForPrompt(p: Profile): string {
  const c = constraintsFor(p);
  const lines: string[] = [];
  lines.push(`- Output language: ${LANG_NAMES[p.lang].english}. Every label, hint, speech, title and guide must be written in this language.`);
  if (p.words === 'easy') {
    lines.push(`- Easy language: short everyday words, one idea per sentence, explain loanwords and menu jargon in plain words (e.g. what an "americano" is). Button labels at most ${c.labelMax} characters.`);
  } else {
    lines.push(`- Normal wording. Button labels at most ${c.labelMax} characters.`);
  }
  if (p.detail === 'step') {
    lines.push(`- Step-by-step: the guide tells the user exactly what to do on this screen and what happens next. Each item hint explains what it is or what pressing it does (max ${c.hintMax} characters).`);
  } else {
    lines.push(`- Brief: hints may be empty or very short (max ${c.hintMax} characters).`);
  }
  lines.push(`- Text size preference: ${p.text}. Layout must use at most ${c.maxColumns} column(s) and at most ${c.maxItemsPerPage} items per page.`);
  if (p.touch === 'large') lines.push('- The user needs large touch targets: avoid crowding, put the most important action first.');
  if (p.voice) lines.push('- Screen reader on: every "speech" field must be a natural sentence that makes sense when heard without seeing the screen.');
  if (p.contrast === 'high') lines.push('- High contrast mode (handled by the renderer; keep icons simple).');
  lines.push('- Priority when space is short: readable text first, then button size, then extra explanation.');
  return lines.join('\n');
}

/** 성공률 측정에 쓰는 대표 프로필 6개 (실제 사용자 정보 아님) */
export const TEST_PROFILES: { name: string; profile: Profile }[] = [
  { name: '큰 글씨', profile: { ...DEFAULT_PROFILE, text: 'large', touch: 'large' } },
  { name: '쉬운 말 + 단계 설명 + 읽어 주기', profile: { ...DEFAULT_PROFILE, words: 'easy', detail: 'step', voice: true } },
  { name: '아주 큰 글씨 + 고대비 + 읽어 주기', profile: { ...DEFAULT_PROFILE, text: 'xlarge', contrast: 'high', voice: true, touch: 'large' } },
  { name: 'English', profile: { ...DEFAULT_PROFILE, lang: 'en' } },
  { name: '中文 + 쉬운 말', profile: { ...DEFAULT_PROFILE, lang: 'zh', words: 'easy' } },
  { name: '모두 켬 (아주 큰 글씨·쉬운 말·단계·읽어 주기·고대비)', profile: { ...DEFAULT_PROFILE, text: 'xlarge', touch: 'large', words: 'easy', detail: 'step', voice: true, contrast: 'high' } },
];

/** 빠른 설정 버튼 (말로 설명하기 어려운 사람용) */
export const QUICK_PRESETS: { id: string; patch: Partial<Profile> }[] = [
  { id: 'see', patch: { text: 'xlarge', touch: 'large', contrast: 'high' } },
  { id: 'slow', patch: { words: 'easy', detail: 'step' } },
  { id: 'listen', patch: { voice: true, detail: 'step' } },
  { id: 'hands', patch: { touch: 'large', text: 'large' } },
];
