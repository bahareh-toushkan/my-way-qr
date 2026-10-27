// 키오스크 SDK 역할: 원래 키오스크 화면을 '구조 데이터'로 내보낸다. AI는 이 데이터만 보고 변환한다.
import { CONTROLS, getStore } from './catalog.js';
import type { ScreenKey, SourceElement, SourceScreen, StoreId } from './types.js';

function control(ref: string, required = true): SourceElement {
  const c = CONTROLS[ref];
  if (!c) throw new Error(`unknown control ${ref}`);
  return { ref, kind: ref.startsWith('nav:') ? 'nav' : 'control', label: c.label, labelEn: c.labelEn, required };
}

export function describeScreen(storeId: StoreId, screenKey: ScreenKey): SourceScreen {
  const store = getStore(storeId);
  const base = { store: storeId, storeName: store.name, screenKey, placeholders: [] as string[] };

  switch (screenKey) {
    case 'menu': {
      const elements: SourceElement[] = [];
      for (const c of store.categories) {
        elements.push({ ref: `cat:${c.id}`, kind: 'category', label: c.label, labelEn: c.labelEn, required: false });
      }
      for (const it of store.items) {
        const cat = store.categories.find((c) => c.id === it.category)!;
        elements.push({
          ref: `item:${it.id}`,
          kind: 'item',
          label: it.name,
          labelEn: it.nameEn,
          group: it.category,
          groupLabel: cat.label,
          price: it.price,
          desc: it.desc,
          allergens: it.allergens,
          required: true,
        });
      }
      elements.push(control('nav:cart'), control('staff'), control('cancel'));
      return {
        ...base,
        purpose:
          'Main menu. The user picks one item. Items with options open an options screen; items without options go straight to the cart. Categories are only grouping labels.',
        elements,
      };
    }
    case 'options': {
      const elements: SourceElement[] = [];
      for (const g of store.groups) {
        for (const v of g.values) {
          elements.push({
            ref: `opt:${g.id}:${v.id}`,
            kind: 'option',
            label: v.label,
            labelEn: v.labelEn,
            group: g.id,
            groupLabel: g.label,
            price: v.extra,
            required: true,
          });
        }
      }
      elements.push(control('qty:+'), control('qty:-'), control('add'), control('back'));
      return {
        ...base,
        purpose:
          'Options for the chosen item. One value per option group (groups not used by the chosen item are hidden by the app). Then choose quantity and press add to put it in the cart, or go back to the menu. "price" on an option is the extra cost in KRW (0 = free).',
        elements,
      };
    }
    case 'cart':
      return {
        ...base,
        purpose:
          'Order check. The app lists each ordered line (item, options, quantity, price) from real data. Your labels are for the per-line buttons (one more / one less / remove) and for the screen buttons: go to payment, add more items, cancel everything, call staff.',
        elements: [control('line:+'), control('line:-'), control('line:del'), control('checkout'), control('more'), control('cancel'), control('staff')],
      };
    case 'pay':
      return {
        ...base,
        purpose:
          'Payment (mock, no real payment). First choose eat-in or take-out, then a payment method. Back returns to the order check. The total amount is shown by the app from real data.',
        elements: [control('where:here'), control('where:togo'), control('pay:card'), control('pay:mobile'), control('back'), control('staff')],
      };
    case 'done':
      return {
        ...base,
        purpose:
          'Order finished. Tell the user their order number with the placeholder {orderNo} (keep it exactly) and that they will be called when it is ready. One button starts a new order.',
        elements: [control('new')],
        placeholders: ['{orderNo}'],
      };
  }
}

export function refsOf(source: SourceScreen, requiredOnly = false): string[] {
  return source.elements.filter((e) => !requiredOnly || e.required).map((e) => e.ref);
}
