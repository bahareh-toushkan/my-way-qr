// '말로 설정하기': 사용자가 쓴 문장 → 표시 설정. AI가 안 되면 낱말 규칙으로 대체.
import { DEFAULT_PROFILE, normalizeProfile } from '../shared/profile.js';
import type { Lang, Profile } from '../shared/types.js';
import { AiError, type AiProvider } from './ai.js';
import { PROFILE_SCHEMA, PROFILE_SYSTEM_PROMPT } from './prompt.js';

export interface ProfileFromTextResult {
  profile: Profile;
  reason: string;
  source: 'ai' | 'rules';
}

export function rulesProfile(text: string, current: Profile): Profile {
  const s = text.toLowerCase();
  const p: Profile = { ...current };
  const has = (...words: string[]) => words.some((w) => s.includes(w));
  if (has('안 보', '안보', '작아', '작은 글', '시력', '눈이', "can't see", 'cannot see', 'small text', 'vision', '看不清', '字太小', 'nhìn', 'chữ nhỏ', 'نمی‌بینم', 'نمیبینم', 'کوچک')) {
    p.text = 'xlarge';
    p.contrast = 'high';
  }
  if (has('누르기', '손이 떨', '손떨', '버튼이 작', 'press', 'tremor', 'shaky', '按不', '手抖', 'khó bấm', 'دکمه')) p.touch = 'large';
  if (has('어려운 말', '어려워', '이해', '한국어가', 'easy', 'simple', 'understand', '难', '简单', 'dễ hiểu', 'ساده')) p.words = 'easy';
  if (has('천천히', '하나씩', '헷갈', 'slow', 'step', 'confus', '一步', '慢', 'từng bước', 'قدم')) p.detail = 'step';
  if (has('소리', '듣고', '읽어', 'hear', 'listen', 'read aloud', 'voice', '听', '朗读', 'nghe', 'بشنوم', 'صدا')) p.voice = true;
  if (has('영어', 'english')) p.lang = 'en';
  else if (has('중국어', '中文', 'chinese', '汉语')) p.lang = 'zh';
  else if (has('베트남', 'tiếng việt', 'vietnam')) p.lang = 'vi';
  else if (has('페르시아', '이란', 'فارسی', 'persian', 'farsi')) p.lang = 'fa';
  return p;
}

export async function profileFromText(text: string, current: Profile, ai: AiProvider | null): Promise<ProfileFromTextResult> {
  const clean = text.trim().slice(0, 300);
  const base = normalizeProfile(current ?? DEFAULT_PROFILE);
  if (ai && ai.name === 'gemini') {
    try {
      const raw = (await ai.generateJson({
        system: PROFILE_SYSTEM_PROMPT,
        user: `Current language: ${base.lang}\nPerson wrote: """${clean}"""`,
        schema: PROFILE_SCHEMA,
        timeoutMs: 15_000,
      })) as Record<string, unknown>;
      const profile = normalizeProfile({ ...base, ...raw });
      const reason = typeof raw.reason === 'string' ? raw.reason.slice(0, 200) : '';
      return { profile, reason, source: 'ai' };
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
    }
  }
  const profile = rulesProfile(clean, base);
  return { profile, reason: '', source: 'rules' };
}

export function isLang(v: unknown): v is Lang {
  return v === 'ko' || v === 'en' || v === 'zh' || v === 'vi' || v === 'fa';
}
