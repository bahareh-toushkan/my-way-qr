// 모의 주문·결제 서버의 상태 기계. 키오스크와 휴대폰이 같은 '버튼 ref'로 같은 상태를 바꾼다.
import { allowedValues, findGroup, findItem, getStore, type StoreDef } from './catalog';
import type { Actor, CartLine, Draft, SessionState, StoreId } from './types';

export function createSession(id: string, store: StoreId, now = Date.now()): SessionState {
  const s = getStore(store);
  return {
    id,
    store,
    step: 'menu',
    category: s.categories[0].id,
    draft: null,
    cart: [],
    where: null,
    payMethod: null,
    orderNo: null,
    staffCalled: false,
    phoneJoined: false,
    lastActor: null,
    notice: null,
    version: 0,
    updatedAt: now,
  };
}

function defaultOptions(store: StoreDef, itemId: string): Record<string, string> {
  const item = findItem(store, itemId);
  const out: Record<string, string> = {};
  if (!item) return out;
  for (const g of item.groups) {
    const vals = allowedValues(store, item, g);
    if (vals[0]) out[g] = vals[0].id;
  }
  return out;
}

export function unitPrice(store: StoreDef, itemId: string, options: Record<string, string>): number {
  const item = findItem(store, itemId);
  if (!item) return 0;
  let p = item.price;
  for (const [gid, vid] of Object.entries(options)) {
    const v = findGroup(store, gid)?.values.find((x) => x.id === vid);
    if (v) p += v.extra;
  }
  return p;
}

export function lineTotal(store: StoreDef, line: Pick<CartLine, 'itemId' | 'options' | 'qty'>): number {
  return unitPrice(store, line.itemId, line.options) * line.qty;
}

export function cartTotal(state: SessionState): number {
  const store = getStore(state.store);
  return state.cart.reduce((sum, l) => sum + lineTotal(store, l), 0);
}

export function cartCount(state: SessionState): number {
  return state.cart.reduce((sum, l) => sum + l.qty, 0);
}

function sameOptions(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

function addLine(cart: CartLine[], d: Draft, nextId: () => string): CartLine[] {
  const same = cart.find((l) => l.itemId === d.itemId && sameOptions(l.options, d.options));
  if (same) return cart.map((l) => (l === same ? { ...l, qty: Math.min(l.qty + d.qty, 20) } : l));
  return [...cart, { lineId: nextId(), itemId: d.itemId, options: { ...d.options }, qty: d.qty }];
}

export interface ReduceResult {
  state: SessionState;
  changed: boolean;
  error?: string;
}

/**
 * ref 형식
 *  cat:<id> | item:<id> | opt:<group>:<value> | qty:+ | qty:- | add | back
 *  nav:cart | more | line:<lineId>:+ | line:<lineId>:- | line:<lineId>:del | checkout
 *  where:here | where:togo | pay:card | pay:mobile | cancel | staff | staff:done | new | join
 */
export function reduce(
  prev: SessionState,
  ref: string,
  actor: Actor,
  opts: { now?: number; orderNo?: () => string; lineId?: () => string } = {},
): ReduceResult {
  const store = getStore(prev.store);
  const now = opts.now ?? Date.now();
  const nextLineId = opts.lineId ?? (() => Math.random().toString(36).slice(2, 8));
  const s: SessionState = { ...prev, notice: null };
  const fail = (error: string): ReduceResult => ({ state: prev, changed: false, error });
  const parts = ref.split(':');

  switch (parts[0]) {
    case 'join':
      if (actor !== 'phone') return fail('join은 휴대폰에서만');
      s.phoneJoined = true;
      break;
    case 'cat': {
      if (!store.categories.some((c) => c.id === parts[1])) return fail('없는 분류');
      s.category = parts[1];
      s.step = 'menu';
      break;
    }
    case 'item': {
      const item = findItem(store, parts[1]);
      if (!item) return fail('없는 메뉴');
      if (s.step === 'done') return fail('주문이 끝났어요');
      if (item.groups.length === 0) {
        s.cart = addLine(s.cart, { itemId: item.id, options: {}, qty: 1 }, nextLineId);
        s.notice = `added:${item.id}`;
        s.step = 'menu';
        s.draft = null;
      } else {
        s.draft = { itemId: item.id, options: defaultOptions(store, item.id), qty: 1 };
        s.category = item.category;
        s.step = 'options';
      }
      break;
    }
    case 'opt': {
      if (!s.draft) return fail('고른 메뉴가 없어요');
      const item = findItem(store, s.draft.itemId);
      const [, gid, vid] = parts;
      if (!item || !item.groups.includes(gid)) return fail('이 메뉴에 없는 옵션');
      if (!allowedValues(store, item, gid).some((v) => v.id === vid)) return fail('고를 수 없는 옵션');
      s.draft = { ...s.draft, options: { ...s.draft.options, [gid]: vid } };
      break;
    }
    case 'qty': {
      if (!s.draft) return fail('고른 메뉴가 없어요');
      const q = parts[1] === '+' ? s.draft.qty + 1 : s.draft.qty - 1;
      s.draft = { ...s.draft, qty: Math.max(1, Math.min(20, q)) };
      break;
    }
    case 'add': {
      if (!s.draft) return fail('고른 메뉴가 없어요');
      s.cart = addLine(s.cart, s.draft, nextLineId);
      s.notice = `added:${s.draft.itemId}`;
      s.draft = null;
      s.step = 'menu';
      break;
    }
    case 'back': {
      if (s.step === 'options' || s.step === 'cart') {
        s.draft = null;
        s.step = 'menu';
      } else if (s.step === 'pay') {
        s.step = 'cart';
      } else return fail('뒤로 갈 곳이 없어요');
      break;
    }
    case 'nav':
      if (parts[1] !== 'cart') return fail('알 수 없는 이동');
      if (s.step === 'done') return fail('주문이 끝났어요');
      s.draft = null;
      s.step = 'cart';
      break;
    case 'more':
      if (s.step === 'done') return fail('주문이 끝났어요');
      s.draft = null;
      s.step = 'menu';
      break;
    case 'line': {
      const [, lineId, op] = parts;
      const line = s.cart.find((l) => l.lineId === lineId);
      if (!line) return fail('없는 주문 줄');
      if (op === '+') s.cart = s.cart.map((l) => (l === line ? { ...l, qty: Math.min(20, l.qty + 1) } : l));
      else if (op === '-') s.cart = s.cart.map((l) => (l === line ? { ...l, qty: Math.max(1, l.qty - 1) } : l));
      else if (op === 'del') s.cart = s.cart.filter((l) => l !== line);
      else return fail('알 수 없는 동작');
      break;
    }
    case 'checkout':
      if (s.cart.length === 0) return fail('장바구니가 비어 있어요');
      s.step = 'pay';
      break;
    case 'where':
      if (s.step !== 'pay') return fail('결제 화면이 아니에요');
      if (parts[1] !== 'here' && parts[1] !== 'togo') return fail('알 수 없는 선택');
      s.where = parts[1];
      break;
    case 'pay': {
      if (s.step !== 'pay') return fail('결제 화면이 아니에요');
      if (s.cart.length === 0) return fail('장바구니가 비어 있어요');
      if (!s.where) return fail('먼저 매장/포장을 골라 주세요');
      if (parts[1] !== 'card' && parts[1] !== 'mobile') return fail('알 수 없는 결제 수단');
      s.payMethod = parts[1];
      s.orderNo = opts.orderNo ? opts.orderNo() : String(100 + Math.floor(Math.random() * 900));
      s.step = 'done';
      break;
    }
    case 'cancel':
    case 'new': {
      const fresh = createSession(s.id, s.store, now);
      fresh.phoneJoined = s.phoneJoined;
      fresh.version = s.version;
      Object.assign(s, fresh);
      break;
    }
    case 'staff':
      if (parts[1] === 'done') s.staffCalled = false;
      else s.staffCalled = true;
      break;
    default:
      return fail('알 수 없는 버튼');
  }

  s.lastActor = actor;
  s.version = prev.version + 1;
  s.updatedAt = now;
  return { state: s, changed: true };
}

/** 정정 동작(뒤로·삭제·빼기·취소) 수 — 사용자 테스트 기록용 */
export function isCorrection(ref: string): boolean {
  return ref === 'back' || ref === 'cancel' || ref === 'qty:-' || /^line:[^:]+:(-|del)$/.test(ref);
}
