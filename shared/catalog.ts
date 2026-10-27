// 시연용 예시 매장 데이터 (실제 매장·브랜드 아님). 가격·알레르기 정보도 예시 값이다.
import type { StoreId } from './types.js';

export interface OptionValue {
  id: string;
  label: string;
  labelEn: string;
  extra: number;
}

export interface OptionGroup {
  id: string;
  label: string;
  labelEn: string;
  values: OptionValue[];
}

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  nameEn: string;
  price: number;
  desc: string;
  icon: string;
  allergens: string[];
  groups: string[];
  /** 그룹별로 고를 수 있는 값을 제한 (예: 콜드브루는 ICE만) */
  allowed?: Record<string, string[]>;
}

export interface Category {
  id: string;
  label: string;
  labelEn: string;
}

export interface ControlDef {
  ref: string;
  label: string;
  labelEn: string;
}

export interface StoreDef {
  id: StoreId;
  name: string;
  nameEn: string;
  categories: Category[];
  items: MenuItem[];
  groups: OptionGroup[];
}

const cafe: StoreDef = {
  id: 'cafe',
  name: '카페 오늘',
  nameEn: 'Cafe Oneul',
  categories: [
    { id: 'coffee', label: '커피', labelEn: 'Coffee' },
    { id: 'drink', label: '음료', labelEn: 'Drinks' },
    { id: 'tea', label: '차', labelEn: 'Tea' },
    { id: 'dessert', label: '디저트', labelEn: 'Desserts' },
  ],
  groups: [
    {
      id: 'temp',
      label: '온도',
      labelEn: 'Temperature',
      values: [
        { id: 'hot', label: 'HOT', labelEn: 'Hot', extra: 0 },
        { id: 'ice', label: 'ICE', labelEn: 'Iced', extra: 0 },
      ],
    },
    {
      id: 'size',
      label: '사이즈',
      labelEn: 'Size',
      values: [
        { id: 'regular', label: 'Regular', labelEn: 'Regular', extra: 0 },
        { id: 'large', label: 'Large', labelEn: 'Large', extra: 500 },
      ],
    },
    {
      id: 'shot',
      label: '샷',
      labelEn: 'Espresso shot',
      values: [
        { id: 'none', label: '기본', labelEn: 'Standard', extra: 0 },
        { id: 'extra', label: '샷 추가', labelEn: 'Extra shot', extra: 500 },
      ],
    },
  ],
  items: [
    { id: 'americano', category: 'coffee', name: '아메리카노', nameEn: 'Americano', price: 3000, desc: '에스프레소에 물을 더한 커피', icon: '☕', allergens: [], groups: ['temp', 'size', 'shot'] },
    { id: 'latte', category: 'coffee', name: '카페라떼', nameEn: 'Cafe latte', price: 3500, desc: '에스프레소에 우유를 더한 커피', icon: '🥛', allergens: ['우유'], groups: ['temp', 'size', 'shot'] },
    { id: 'vanilla', category: 'coffee', name: '바닐라라떼', nameEn: 'Vanilla latte', price: 4000, desc: '바닐라 시럽을 넣은 달콤한 라떼', icon: '🍦', allergens: ['우유'], groups: ['temp', 'size', 'shot'] },
    { id: 'coldbrew', category: 'coffee', name: '콜드브루', nameEn: 'Cold brew', price: 3800, desc: '찬물로 오래 우려낸 커피', icon: '🧊', allergens: [], groups: ['temp', 'size'], allowed: { temp: ['ice'] } },
    { id: 'decaf', category: 'coffee', name: '디카페인 아메리카노', nameEn: 'Decaf americano', price: 3300, desc: '카페인을 대부분 뺀 아메리카노', icon: '🌙', allergens: [], groups: ['temp', 'size'] },
    { id: 'choco', category: 'drink', name: '초코라떼', nameEn: 'Chocolate latte', price: 3800, desc: '초콜릿과 우유로 만든 음료', icon: '🍫', allergens: ['우유', '대두'], groups: ['temp', 'size'] },
    { id: 'strawberry', category: 'drink', name: '딸기라떼', nameEn: 'Strawberry latte', price: 4300, desc: '딸기청과 우유로 만든 차가운 음료', icon: '🍓', allergens: ['우유'], groups: ['temp', 'size'], allowed: { temp: ['ice'] } },
    { id: 'lemonade', category: 'drink', name: '레몬에이드', nameEn: 'Lemonade', price: 4000, desc: '레몬청에 탄산수를 더한 음료', icon: '🍋', allergens: [], groups: ['temp', 'size'], allowed: { temp: ['ice'] } },
    { id: 'chamomile', category: 'tea', name: '캐모마일 티', nameEn: 'Chamomile tea', price: 3300, desc: '카페인이 없는 꽃차', icon: '🌼', allergens: [], groups: ['temp', 'size'] },
    { id: 'yuja', category: 'tea', name: '유자차', nameEn: 'Yuja tea', price: 3500, desc: '유자청으로 만든 달콤한 차', icon: '🍊', allergens: [], groups: ['temp', 'size'] },
    { id: 'cheesecake', category: 'dessert', name: '치즈케이크', nameEn: 'Cheesecake', price: 4500, desc: '크림치즈로 만든 케이크 한 조각', icon: '🍰', allergens: ['우유', '계란', '밀'], groups: [] },
    { id: 'croissant', category: 'dessert', name: '크루아상', nameEn: 'Croissant', price: 3000, desc: '버터 향이 나는 빵', icon: '🥐', allergens: ['우유', '밀', '계란'], groups: [] },
    { id: 'cookie', category: 'dessert', name: '초코칩 쿠키', nameEn: 'Chocolate chip cookie', price: 2000, desc: '초코칩이 들어간 쿠키', icon: '🍪', allergens: ['밀', '우유', '계란', '대두'], groups: [] },
  ],
};

const restaurant: StoreDef = {
  id: 'restaurant',
  name: '한끼 식당',
  nameEn: 'Hankki Kitchen',
  categories: [
    { id: 'rice', label: '밥', labelEn: 'Rice dishes' },
    { id: 'noodle', label: '면', labelEn: 'Noodles' },
    { id: 'side', label: '사이드', labelEn: 'Sides' },
    { id: 'drink', label: '음료', labelEn: 'Drinks' },
  ],
  groups: [
    {
      id: 'spicy',
      label: '맵기',
      labelEn: 'Spiciness',
      values: [
        { id: 'mild', label: '순한맛', labelEn: 'Mild', extra: 0 },
        { id: 'normal', label: '보통', labelEn: 'Medium', extra: 0 },
        { id: 'hot', label: '매운맛', labelEn: 'Hot', extra: 0 },
      ],
    },
    {
      id: 'riceadd',
      label: '공깃밥',
      labelEn: 'Extra rice',
      values: [
        { id: 'no', label: '추가 안 함', labelEn: 'No extra rice', extra: 0 },
        { id: 'yes', label: '공깃밥 추가', labelEn: 'Add a bowl of rice', extra: 1000 },
      ],
    },
    {
      id: 'portion',
      label: '양',
      labelEn: 'Portion',
      values: [
        { id: 'normal', label: '보통', labelEn: 'Regular', extra: 0 },
        { id: 'large', label: '곱빼기', labelEn: 'Large', extra: 2000 },
      ],
    },
  ],
  items: [
    { id: 'bibimbap', category: 'rice', name: '비빔밥', nameEn: 'Bibimbap', price: 9000, desc: '밥 위에 나물과 고추장을 올려 비벼 먹는 음식', icon: '🍚', allergens: ['대두', '밀', '계란'], groups: ['spicy'] },
    { id: 'kimchistew', category: 'rice', name: '김치찌개', nameEn: 'Kimchi stew', price: 9000, desc: '김치와 돼지고기를 넣고 끓인 찌개 (공깃밥 1개 포함)', icon: '🍲', allergens: ['돼지고기', '대두', '밀'], groups: ['spicy', 'riceadd'] },
    { id: 'jeyuk', category: 'rice', name: '제육덮밥', nameEn: 'Spicy pork rice bowl', price: 9500, desc: '양념한 돼지고기 볶음을 밥 위에 올린 음식', icon: '🥘', allergens: ['돼지고기', '대두', '밀'], groups: ['spicy'] },
    { id: 'janchi', category: 'noodle', name: '잔치국수', nameEn: 'Janchi noodle soup', price: 7000, desc: '멸치 국물에 소면을 넣은 따뜻한 국수', icon: '🍜', allergens: ['밀', '대두', '계란'], groups: ['portion'] },
    { id: 'naengmyeon', category: 'noodle', name: '물냉면', nameEn: 'Cold buckwheat noodles', price: 9000, desc: '차가운 육수에 메밀면을 넣은 국수', icon: '🥶', allergens: ['밀', '쇠고기', '계란'], groups: ['portion'] },
    { id: 'ramen', category: 'noodle', name: '라면', nameEn: 'Ramyeon', price: 5000, desc: '매운 국물에 꼬불꼬불한 면', icon: '🌶️', allergens: ['밀', '대두'], groups: ['portion'] },
    { id: 'dumpling', category: 'side', name: '군만두', nameEn: 'Fried dumplings', price: 5000, desc: '바삭하게 구운 만두 6개', icon: '🥟', allergens: ['밀', '돼지고기', '대두'], groups: [] },
    { id: 'eggroll', category: 'side', name: '계란말이', nameEn: 'Rolled omelette', price: 6000, desc: '계란을 부쳐 돌돌 만 반찬', icon: '🍳', allergens: ['계란'], groups: [] },
    { id: 'cola', category: 'drink', name: '콜라', nameEn: 'Cola', price: 2000, desc: '탄산음료 1캔', icon: '🥤', allergens: [], groups: [] },
    { id: 'cider', category: 'drink', name: '사이다', nameEn: 'Lemon-lime soda', price: 2000, desc: '탄산음료 1캔', icon: '🫧', allergens: [], groups: [] },
  ],
};

export const STORES: Record<StoreId, StoreDef> = { cafe, restaurant };

export function getStore(id: StoreId): StoreDef {
  const s = STORES[id];
  if (!s) throw new Error(`unknown store: ${id}`);
  return s;
}

export function findItem(store: StoreDef, itemId: string): MenuItem | undefined {
  return store.items.find((i) => i.id === itemId);
}

export function findGroup(store: StoreDef, groupId: string): OptionGroup | undefined {
  return store.groups.find((g) => g.id === groupId);
}

/** 이 메뉴에서 고를 수 있는 옵션 값 목록 */
export function allowedValues(store: StoreDef, item: MenuItem, groupId: string): OptionValue[] {
  const g = findGroup(store, groupId);
  if (!g) return [];
  const allow = item.allowed?.[groupId];
  return allow ? g.values.filter((v) => allow.includes(v.id)) : g.values;
}

/** 화면마다 공통으로 있는 버튼 */
export const CONTROLS: Record<string, ControlDef> = {
  'nav:cart': { ref: 'nav:cart', label: '장바구니', labelEn: 'Cart' },
  staff: { ref: 'staff', label: '직원 호출', labelEn: 'Call staff' },
  cancel: { ref: 'cancel', label: '처음으로', labelEn: 'Start over' },
  'qty:+': { ref: 'qty:+', label: '수량 +', labelEn: 'One more' },
  'qty:-': { ref: 'qty:-', label: '수량 -', labelEn: 'One less' },
  add: { ref: 'add', label: '담기', labelEn: 'Add to order' },
  back: { ref: 'back', label: '이전', labelEn: 'Back' },
  'line:+': { ref: 'line:+', label: '+', labelEn: 'One more' },
  'line:-': { ref: 'line:-', label: '-', labelEn: 'One less' },
  'line:del': { ref: 'line:del', label: '삭제', labelEn: 'Remove' },
  checkout: { ref: 'checkout', label: '결제하기', labelEn: 'Go to payment' },
  more: { ref: 'more', label: '추가 주문', labelEn: 'Add more' },
  'where:here': { ref: 'where:here', label: '매장', labelEn: 'Eat here' },
  'where:togo': { ref: 'where:togo', label: '포장', labelEn: 'Take out' },
  'pay:card': { ref: 'pay:card', label: '신용카드', labelEn: 'Credit card' },
  'pay:mobile': { ref: 'pay:mobile', label: '간편결제', labelEn: 'Mobile pay' },
  new: { ref: 'new', label: '처음 화면', labelEn: 'New order' },
};

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 휴대폰 화면 가격 표시: 한국어는 '3,000원', 그 밖의 언어는 '₩3,000' */
export function formatPrice(n: number, lang: string): string {
  return lang === 'ko' ? formatWon(n) : `₩${n.toLocaleString('en-US')}`;
}
