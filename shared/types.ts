// 공통 타입: 키오스크(원래 화면), 사용자 '내 방식' 프로필, AI가 만든 변환 화면, 세션 상태

export type Lang = 'ko' | 'en' | 'zh' | 'vi' | 'fa';
export const LANGS: Lang[] = ['ko', 'en', 'zh', 'vi', 'fa'];

/** 사용자가 원하는 '방식'만 저장한다. 장애 유형·이름 같은 개인정보는 담지 않는다. */
export interface Profile {
  v: 1;
  lang: Lang;
  text: 'normal' | 'large' | 'xlarge';
  touch: 'normal' | 'large';
  words: 'normal' | 'easy';
  detail: 'short' | 'step';
  voice: boolean;
  contrast: 'normal' | 'high';
}

export type StoreId = 'cafe' | 'restaurant';
export const STORE_IDS: StoreId[] = ['cafe', 'restaurant'];

export type ScreenKey = 'menu' | 'options' | 'cart' | 'pay' | 'done';
export const SCREEN_KEYS: ScreenKey[] = ['menu', 'options', 'cart', 'pay', 'done'];

/** 키오스크 SDK가 내보내는 원래 화면의 요소 하나 */
export interface SourceElement {
  ref: string;
  kind: 'category' | 'item' | 'option' | 'control' | 'nav';
  label: string;
  labelEn: string;
  group?: string;
  groupLabel?: string;
  price?: number;
  desc?: string;
  allergens?: string[];
  required: boolean;
}

/** 키오스크 SDK가 내보내는 원래 화면 */
export interface SourceScreen {
  store: StoreId;
  storeName: string;
  screenKey: ScreenKey;
  purpose: string;
  elements: SourceElement[];
  placeholders: string[];
}

export type Priority = 'primary' | 'normal' | 'secondary';

export interface AdaptedItem {
  ref: string;
  label: string;
  hint: string;
  speech: string;
  icon: string;
  priority: Priority;
}

export interface AdaptedSection {
  title: string;
  speech: string;
  items: AdaptedItem[];
}

/** AI(또는 규칙)가 만든 '내 방식' 화면 */
export interface AdaptedScreen {
  title: string;
  guide: string;
  speech: string;
  layout: { columns: number; itemsPerPage: number };
  sections: AdaptedSection[];
}

export interface ValidationIssue {
  code: string;
  severity: 'hard' | 'soft';
  message: string;
  ref?: string;
}

export interface ValidationResult {
  ok: boolean;
  hardCount: number;
  softCount: number;
  issues: ValidationIssue[];
}

export interface AttemptLog {
  ms: number;
  ok: boolean;
  hard: number;
  soft: number;
  codes: string[];
  error?: string;
}

export type AdaptSource = 'ai' | 'ai-retry' | 'cache' | 'fallback';

export interface AdaptResponse {
  spec: AdaptedScreen;
  source: AdaptSource;
  provider: string;
  model: string;
  validation: ValidationResult;
  attempts: AttemptLog[];
  latencyMs: number;
  fallbackReason?: string;
  promptVersion: string;
}

// ---- 세션(모의 주문·결제 서버) ----

export type Step = 'menu' | 'options' | 'cart' | 'pay' | 'done';

export interface Draft {
  itemId: string;
  options: Record<string, string>;
  qty: number;
}

export interface CartLine {
  lineId: string;
  itemId: string;
  options: Record<string, string>;
  qty: number;
}

export type Actor = 'kiosk' | 'phone';

export interface SessionState {
  id: string;
  store: StoreId;
  step: Step;
  category: string;
  draft: Draft | null;
  cart: CartLine[];
  where: 'here' | 'togo' | null;
  payMethod: 'card' | 'mobile' | null;
  orderNo: string | null;
  staffCalled: boolean;
  phoneJoined: boolean;
  lastActor: Actor | null;
  notice: string | null;
  version: number;
  updatedAt: number;
}

/** 사용자 테스트 기록 (익명: 시간·동작 수만) */
export interface MetricRecord {
  mode: 'adapted' | 'original';
  store: StoreId;
  profileKey: string;
  durationMs: number;
  actions: number;
  corrections: number;
  completed: boolean;
  at: number;
}
