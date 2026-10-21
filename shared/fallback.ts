// AI가 실패하거나 한도를 넘었을 때 쓰는 규칙 기반 '간단 화면'. 원래 데이터만 사용한다.
import { findItem, getStore } from './catalog';
import { t } from './i18n';
import { constraintsFor } from './profile';
import type { AdaptedItem, AdaptedScreen, AdaptedSection, Priority, Profile, SourceElement, SourceScreen } from './types';

function labelOf(e: SourceElement, useKo: boolean): string {
  return useKo ? e.label : e.labelEn;
}

function toItem(e: SourceElement, profile: Profile, priority: Priority = 'normal'): AdaptedItem {
  const useKo = profile.lang === 'ko';
  const label = labelOf(e, useKo);
  const hint = useKo && profile.detail === 'step' && e.desc ? e.desc : '';
  return { ref: e.ref, label, hint, speech: hint ? `${label}. ${hint}` : label, icon: '', priority };
}

export function fallbackSpec(source: SourceScreen, profile: Profile): AdaptedScreen {
  const c = constraintsFor(profile);
  const ui = t(profile.lang);
  const useKo = profile.lang === 'ko';
  const store = getStore(source.store);
  const sections: AdaptedSection[] = [];
  const byKind = (k: SourceElement['kind']) => source.elements.filter((e) => e.kind === k);
  const controlsSection = (refs: string[], title: string, primary?: string) => {
    const items = source.elements
      .filter((e) => refs.includes(e.ref))
      .map((e) => toItem(e, profile, e.ref === primary ? 'primary' : 'normal'));
    if (items.length) sections.push({ title, speech: title, items });
  };

  switch (source.screenKey) {
    case 'menu': {
      for (const cat of store.categories) {
        const items = byKind('item')
          .filter((e) => e.group === cat.id)
          .map((e) => {
            const it = toItem(e, profile);
            it.icon = findItem(store, e.ref.slice(5))?.icon ?? '';
            return it;
          });
        const title = useKo ? cat.label : cat.labelEn;
        sections.push({ title, speech: title, items });
      }
      controlsSection(['nav:cart', 'staff', 'cancel'], ui.sections.controls, 'nav:cart');
      break;
    }
    case 'options': {
      for (const g of store.groups) {
        const items = byKind('option')
          .filter((e) => e.group === g.id)
          .map((e) => toItem(e, profile));
        const title = useKo ? g.label : g.labelEn;
        sections.push({ title, speech: title, items });
      }
      controlsSection(['qty:-', 'qty:+'], ui.sections.qty);
      controlsSection(['add', 'back'], ui.sections.controls, 'add');
      break;
    }
    case 'cart':
      controlsSection(['line:+', 'line:-', 'line:del'], ui.sections.lines);
      controlsSection(['checkout', 'more', 'cancel', 'staff'], ui.sections.controls, 'checkout');
      break;
    case 'pay':
      controlsSection(['where:here', 'where:togo'], ui.sections.where);
      controlsSection(['pay:card', 'pay:mobile'], ui.sections.payMethod);
      controlsSection(['back', 'staff'], ui.sections.controls);
      break;
    case 'done':
      controlsSection(['new'], ui.sections.controls, 'new');
      break;
  }

  const guide = ui.guides[source.screenKey];
  return {
    title: useKo ? store.name : store.nameEn,
    guide,
    speech: guide,
    layout: { columns: c.maxColumns, itemsPerPage: c.maxItemsPerPage },
    sections,
  };
}
