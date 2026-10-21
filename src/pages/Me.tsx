// 휴대폰 '내 방식' 주문 화면: 키오스크 화면을 AI가 바꾼 결과를 보여 주고, 누른 버튼을 원래 키오스크로 보낸다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allowedValues, findGroup, findItem, formatPrice, getStore, type StoreDef } from '../../shared/catalog';
import { allergenName, fill, isRtl, t } from '../../shared/i18n';
import { constraintsFor, DEFAULT_PROFILE, profileKey } from '../../shared/profile';
import { cartCount, cartTotal, isCorrection, lineTotal, unitPrice } from '../../shared/reducer';
import type { AdaptedItem, AdaptResponse, Profile, ScreenKey, SessionState } from '../../shared/types';
import { api } from '../lib/api';
import { speak, stopSpeaking } from '../lib/speech';
import { loadProfile, saveProfile } from '../lib/storage';
import { useSession } from '../lib/useSession';
import Setup from './Setup';

const ORDER: ScreenKey[] = ['menu', 'options', 'cart', 'pay', 'done'];

export default function Me() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const sid = params.get('s');
  const testMode = params.get('test') === '1';
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [editing, setEditing] = useState(() => loadProfile() === null);

  if (!sid) {
    const ui = t(profile?.lang ?? 'ko');
    return (
      <div className="me center">
        <h1>📱 {ui.appName}</h1>
        <p>키오스크 화면의 QR 코드를 휴대폰 카메라로 찍어 주세요.</p>
        <p>
          <a href="/kiosk">시연용 키오스크 열기</a>
        </p>
      </div>
    );
  }
  if (editing || !profile) {
    return (
      <Setup
        initial={profile ?? DEFAULT_PROFILE}
        testMode={testMode}
        onDone={(p) => {
          saveProfile(p);
          setProfile(p);
          setEditing(false);
        }}
      />
    );
  }
  return <Ordering sid={sid} profile={profile} testMode={testMode} onEdit={() => setEditing(true)} />;
}

type Specs = Partial<Record<ScreenKey, AdaptResponse>>;

function Ordering({ sid, profile, testMode, onEdit }: { sid: string; profile: Profile; testMode: boolean; onEdit: () => void }) {
  const { state, gone, error, busy, send } = useSession(sid, 'phone', 1200);
  const ui = t(profile.lang);
  const c = constraintsFor(profile);
  const [specs, setSpecs] = useState<Specs>({});
  const [specError, setSpecError] = useState<string | null>(null);
  const inflight = useRef<Partial<Record<ScreenKey, Promise<void>>>>({});
  const joined = useRef(false);
  const store = state ? getStore(state.store) : null;

  // 처음 연결되면 키오스크에 '휴대폰 연결' 알림
  useEffect(() => {
    if (state && !joined.current) {
      joined.current = true;
      if (!state.phoneJoined) send('join');
    }
  }, [state, send]);

  // 프로필이 바뀌면 변환 화면을 새로 받는다
  useEffect(() => {
    setSpecs({});
    inflight.current = {};
  }, [profile]);

  const load = useCallback(
    (key: ScreenKey): Promise<void> => {
      if (!state) return Promise.resolve();
      const existing = inflight.current[key];
      if (existing) return existing;
      const p = api
        .adapt(state.store, key, profile)
        .then((r) => {
          setSpecs((s) => ({ ...s, [key]: r }));
          setSpecError(null);
        })
        .catch((e: Error) => {
          delete inflight.current[key];
          setSpecError(e.message);
        });
      inflight.current[key] = p;
      return p;
    },
    [state?.store, profile], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const step = state?.step;
  // 지금 화면을 먼저, 나머지는 뒤에서 차례로 미리 받기
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    (async () => {
      await load(step);
      for (const k of ORDER) {
        if (cancelled) return;
        if (k !== step) await load(k);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, load]);

  const spec = step ? specs[step] : undefined;

  // 화면이 바뀌면 안내 읽어 주기
  useEffect(() => {
    if (profile.voice && spec && state) speak(fill(spec.spec.speech || spec.spec.guide, { orderNo: state.orderNo ?? '' }), profile.lang);
    return () => stopSpeaking();
  }, [spec, profile.voice, profile.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // 사용자 테스트 기록 (test=1일 때만, 익명)
  const metric = useRef<{ start: number; actions: number; corrections: number; sent: boolean } | null>(null);
  useEffect(() => {
    if (testMode && spec && !metric.current) metric.current = { start: performance.now(), actions: 0, corrections: 0, sent: false };
  }, [testMode, spec]);
  useEffect(() => {
    const m = metric.current;
    if (testMode && state?.step === 'done' && m && !m.sent) {
      m.sent = true;
      api.metric({ mode: 'adapted', store: state.store, profileKey: profileKey(profile), durationMs: performance.now() - m.start, actions: m.actions, corrections: m.corrections, completed: true });
    }
  }, [state?.step, testMode, profile, state?.store]);

  const press = useCallback(
    (ref: string, item?: AdaptedItem) => {
      if (profile.voice && item) speak(item.speech || item.label, profile.lang);
      if (metric.current) {
        metric.current.actions++;
        if (isCorrection(ref)) metric.current.corrections++;
      }
      return send(ref);
    },
    [send, profile.voice, profile.lang],
  );

  // '담았어요' 알림
  const [toast, setToast] = useState<string | null>(null);
  const menuLabels = useMemo(() => labelMap(specs.menu), [specs.menu]);
  useEffect(() => {
    if (!state?.notice?.startsWith('added:') || !store) return;
    const id = state.notice.slice(6);
    const name = menuLabels.get(`item:${id}`) ?? findItem(store, id)?.name ?? '';
    setToast(fill(ui.added, { name }));
    const tm = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(tm);
  }, [state?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const rootProps = {
    className: `me ${profile.contrast === 'high' ? 'hc' : ''}`,
    dir: isRtl(profile.lang) ? 'rtl' : 'ltr',
    lang: profile.lang,
    style: { ['--fs' as string]: c.fontScale, ['--target' as string]: `${c.minTargetPx}px` },
  } as const;

  if (gone) return <div {...rootProps} className={`${rootProps.className} center`}><p>{ui.sessionGone}</p></div>;
  if (!state || !store) return <div {...rootProps} className={`${rootProps.className} center`}><p>…</p></div>;

  const stepIndex = { menu: 0, options: 1, cart: 2, pay: 3, done: 4 }[state.step];

  return (
    <div {...rootProps}>
      <header className="me-head">
        <div className="me-title">{spec?.spec.title || (profile.lang === 'ko' ? store.name : store.nameEn)}</div>
        <div className="me-tools">
          <button aria-label={ui.listen} onClick={() => spec && speak(fill(`${spec.spec.guide} ${spec.spec.speech}`, { orderNo: state.orderNo ?? '' }), profile.lang)}>
            🔊
          </button>
          <button aria-label={ui.settings} onClick={onEdit}>
            ⚙️
          </button>
          <button aria-label={ui.callStaff} className={state.staffCalled ? 'on' : ''} onClick={() => press('staff')}>
            🙋
          </button>
        </div>
      </header>

      <ol className="steps" aria-label="progress">
        {ui.steps.map((s, i) => (
          <li key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'now' : ''}>
            {s}
          </li>
        ))}
      </ol>

      {state.staffCalled && <div className="note staff">🙋 {ui.staffCalled}</div>}
      {testMode && <div className="note test">🧪 테스트 기록 중</div>}

      {!spec && (
        <div className="loading" role="status">
          <div className="spinner" />
          <p>{ui.loadingFirst}</p>
          {specError && (
            <p className="err">
              {ui.retrying} ({specError})
              <button className="btn secondary" onClick={() => load(state.step)}>
                ↻
              </button>
            </p>
          )}
        </div>
      )}

      {spec && (
        <main className="me-body">
          <p className="guide">{fill(spec.spec.guide, { orderNo: state.orderNo ?? '' })}</p>
          <Badge r={spec} ui={ui} />
          <Screen state={state} store={store} spec={spec} specs={specs} profile={profile} press={press} busy={busy} />
        </main>
      )}

      {state.step !== 'done' && state.step !== 'pay' && cartCount(state) > 0 && (
        <footer className="me-foot">
          <span>
            🛒 {cartCount(state)} · {ui.total} <b>{formatPrice(cartTotal(state), profile.lang)}</b>
          </span>
        </footer>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      {error && <div className="toast err" role="alert">{error}</div>}
    </div>
  );
}

function Badge({ r, ui }: { r: AdaptResponse; ui: ReturnType<typeof t> }) {
  const ai = r.source !== 'fallback';
  return (
    <div className={`badge ${ai ? 'ai' : 'rule'}`} title={`${r.provider}/${r.model} · ${r.source}`}>
      {ai ? `✨ ${ui.badgeAi}` : `ℹ️ ${ui.badgeFallback}`}
    </div>
  );
}

function labelMap(r?: AdaptResponse): Map<string, string> {
  const m = new Map<string, string>();
  r?.spec.sections.forEach((s) => s.items.forEach((i) => m.set(i.ref, i.label)));
  return m;
}

function itemMap(r?: AdaptResponse): Map<string, AdaptedItem> {
  const m = new Map<string, AdaptedItem>();
  r?.spec.sections.forEach((s) => s.items.forEach((i) => m.set(i.ref, i)));
  return m;
}

interface ScreenProps {
  state: SessionState;
  store: StoreDef;
  spec: AdaptResponse;
  specs: Specs;
  profile: Profile;
  press: (ref: string, item?: AdaptedItem) => Promise<unknown>;
  busy: boolean;
}

function Screen(props: ScreenProps) {
  switch (props.state.step) {
    case 'menu':
      return <MenuScreen {...props} />;
    case 'options':
      return <OptionsScreen {...props} />;
    case 'cart':
      return <CartScreen {...props} />;
    case 'pay':
      return <PayScreen {...props} />;
    case 'done':
      return <DoneScreen {...props} />;
  }
}

/** 버튼 하나 (가격·알레르기는 AI가 아니라 매장 데이터에서) */
function Btn({ item, sub, extra, selected, disabled, onPress, profile }: { item: AdaptedItem; sub?: string; extra?: string; selected?: boolean; disabled?: boolean; onPress: () => void; profile: Profile }) {
  return (
    <div className={`btn-wrap ${item.priority}`}>
      <button
        className={`btn item ${item.priority} ${selected ? 'on' : ''}`}
        aria-pressed={selected === undefined ? undefined : selected}
        disabled={disabled}
        onClick={onPress}
      >
        {item.icon && <span className="ic" aria-hidden="true">{item.icon}</span>}
        <span className="lb">{item.label}</span>
        {sub && <span className="pr">{sub}</span>}
        {item.hint && <span className="hint">{item.hint}</span>}
        {extra && <span className="allergy">{extra}</span>}
      </button>
      {profile.voice && (
        <button className="say" aria-label="🔊" onClick={() => speak(item.speech || item.label, profile.lang)}>
          🔊
        </button>
      )}
    </div>
  );
}

function Section({ title, items, columns, perPage, lang, render }: { title: string; items: AdaptedItem[]; columns: number; perPage: number; lang: Profile['lang']; render: (i: AdaptedItem) => React.ReactNode }) {
  const [shown, setShown] = useState(perPage);
  const ui = t(lang);
  if (items.length === 0) return null;
  const rest = items.length - shown;
  return (
    <section className="sec">
      {title && <h2>{title}</h2>}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.slice(0, shown).map((i) => (
          <div key={i.ref}>{render(i)}</div>
        ))}
      </div>
      {rest > 0 && (
        <button className="btn more" onClick={() => setShown((s) => s + perPage)}>
          ⬇ {fill(ui.showMore, { n: rest })}
        </button>
      )}
    </section>
  );
}

function layoutOf(spec: AdaptResponse, profile: Profile) {
  const c = constraintsFor(profile);
  // 화면 폭에 맞지 않으면 열을 줄인다 (글씨 > 버튼 > 설명 순서를 지키기 위해)
  const fit = Math.max(1, Math.floor(window.innerWidth / (190 * c.fontScale + (profile.voice ? 60 : 0))));
  return {
    columns: Math.max(1, Math.min(spec.spec.layout.columns, c.maxColumns, fit)),
    perPage: Math.max(1, Math.min(spec.spec.layout.itemsPerPage, c.maxItemsPerPage)),
  };
}

function MenuScreen({ state, store, spec, profile, press, busy }: ScreenProps) {
  const ui = t(profile.lang);
  const { columns, perPage } = layoutOf(spec, profile);
  const count = cartCount(state);
  return (
    <>
      {spec.spec.sections.map((sec, si) => (
        <Section
          key={si}
          title={sec.title}
          columns={columns}
          perPage={perPage}
          lang={profile.lang}
          items={sec.items.filter((i) => !i.ref.startsWith('cat:'))}
          render={(i) => {
            if (i.ref.startsWith('item:')) {
              const it = findItem(store, i.ref.slice(5));
              const al = it && it.allergens.length ? `${ui.allergens}: ${it.allergens.map((a) => allergenName(a, profile.lang)).join(', ')}` : undefined;
              return <Btn item={i} sub={it ? formatPrice(it.price, profile.lang) : undefined} extra={profile.detail === 'step' || profile.words === 'easy' ? al : undefined} disabled={busy} onPress={() => press(i.ref, i)} profile={profile} />;
            }
            const withCount = i.ref === 'nav:cart' && count > 0 ? { ...i, label: `${i.label} (${count})` } : i;
            return <Btn item={withCount} disabled={busy || (i.ref === 'nav:cart' && count === 0)} onPress={() => press(i.ref, i)} profile={profile} />;
          }}
        />
      ))}
    </>
  );
}

function OptionsScreen({ state, store, spec, specs, profile, press, busy }: ScreenProps) {
  const ui = t(profile.lang);
  const { columns, perPage } = layoutOf(spec, profile);
  const draft = state.draft;
  const item = draft ? findItem(store, draft.itemId) : undefined;
  if (!draft || !item) return null;
  const menuItem = itemMap(specs.menu).get(`item:${item.id}`);
  const usable = (ref: string) => {
    if (!ref.startsWith('opt:')) return true;
    const [, g, v] = ref.split(':');
    return item.groups.includes(g) && allowedValues(store, item, g).some((x) => x.id === v);
  };
  const price = unitPrice(store, item.id, draft.options) * draft.qty;
  return (
    <>
      <div className="chosen">
        <span className="ic">{menuItem?.icon || item.icon}</span>
        <div>
          <div className="lb">{menuItem?.label ?? (profile.lang === 'ko' ? item.name : item.nameEn)}</div>
          <div className="pr">
            {formatPrice(price, profile.lang)} · {ui.qty} {draft.qty}
          </div>
        </div>
      </div>
      {spec.spec.sections.map((sec, si) => (
        <Section
          key={si}
          title={sec.title}
          columns={columns}
          perPage={perPage}
          lang={profile.lang}
          items={sec.items.filter((i) => usable(i.ref))}
          render={(i) => {
            if (i.ref.startsWith('opt:')) {
              const [, g, v] = i.ref.split(':');
              const val = findGroup(store, g)?.values.find((x) => x.id === v);
              const sub = val && val.extra > 0 ? `+${formatPrice(val.extra, profile.lang)}` : ui.noExtra;
              return <Btn item={i} sub={sub} selected={draft.options[g] === v} disabled={busy} onPress={() => press(i.ref, i)} profile={profile} />;
            }
            if (i.ref === 'add') return <Btn item={i} sub={formatPrice(price, profile.lang)} disabled={busy} onPress={() => press(i.ref, i)} profile={profile} />;
            if (i.ref === 'qty:-') return <Btn item={i} sub={`${ui.qty} ${draft.qty}`} disabled={busy || draft.qty <= 1} onPress={() => press(i.ref, i)} profile={profile} />;
            return <Btn item={i} disabled={busy} onPress={() => press(i.ref, i)} profile={profile} />;
          }}
        />
      ))}
    </>
  );
}

function optionText(store: StoreDef, options: Record<string, string>, labels: Map<string, string>, lang: Profile['lang']): string {
  return Object.entries(options)
    .map(([g, v]) => labels.get(`opt:${g}:${v}`) ?? (lang === 'ko' ? findGroup(store, g)?.values.find((x) => x.id === v)?.label : findGroup(store, g)?.values.find((x) => x.id === v)?.labelEn))
    .filter(Boolean)
    .join(' · ');
}

function CartScreen({ state, store, spec, specs, profile, press, busy }: ScreenProps) {
  const ui = t(profile.lang);
  const { columns, perPage } = layoutOf(spec, profile);
  const items = itemMap(spec);
  const menu = itemMap(specs.menu);
  const optLabels = labelMap(specs.options);
  const lineBtn = (ref: string) => items.get(ref);
  return (
    <>
      {state.cart.length === 0 && <p className="empty">{ui.cartEmpty}</p>}
      <ul className="lines">
        {state.cart.map((l) => {
          const mi = menu.get(`item:${l.itemId}`);
          const it = findItem(store, l.itemId);
          return (
            <li key={l.lineId} className="line">
              <div className="line-top">
                <span className="ic">{mi?.icon || it?.icon}</span>
                <div className="line-text">
                  <div className="lb">
                    {mi?.label ?? (profile.lang === 'ko' ? it?.name : it?.nameEn)} × {l.qty}
                  </div>
                  <div className="opts">{optionText(store, l.options, optLabels, profile.lang)}</div>
                </div>
                <b className="pr">{formatPrice(lineTotal(store, l), profile.lang)}</b>
              </div>
              <div className="line-ctl">
                {(['line:-', 'line:+', 'line:del'] as const).map((r) => {
                  const b = lineBtn(r);
                  if (!b) return null;
                  return (
                    <button key={r} className={`btn small ${r === 'line:del' ? 'danger' : ''}`} disabled={busy || (r === 'line:-' && l.qty <= 1)} onClick={() => press(`line:${l.lineId}:${r.split(':')[1]}`, b)}>
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="total">
        {ui.total} <b>{formatPrice(cartTotal(state), profile.lang)}</b>
      </div>
      {spec.spec.sections.map((sec, si) => (
        <Section
          key={si}
          title={sec.title}
          columns={columns}
          perPage={perPage}
          lang={profile.lang}
          items={sec.items.filter((i) => !i.ref.startsWith('line:'))}
          render={(i) => <Btn item={i} disabled={busy || (i.ref === 'checkout' && state.cart.length === 0)} onPress={() => press(i.ref, i)} profile={profile} />}
        />
      ))}
    </>
  );
}

function PayScreen({ state, spec, profile, press, busy }: ScreenProps) {
  const ui = t(profile.lang);
  const { columns, perPage } = layoutOf(spec, profile);
  return (
    <>
      <div className="total big">
        {ui.total} <b>{formatPrice(cartTotal(state), profile.lang)}</b>
      </div>
      {!state.where && <p className="note">{ui.chooseWhereFirst}</p>}
      {spec.spec.sections.map((sec, si) => (
        <Section
          key={si}
          title={sec.title}
          columns={columns}
          perPage={perPage}
          lang={profile.lang}
          items={sec.items}
          render={(i) => {
            const isWhere = i.ref.startsWith('where:');
            const isPay = i.ref.startsWith('pay:');
            return (
              <Btn
                item={i}
                selected={isWhere ? state.where === i.ref.slice(6) : undefined}
                disabled={busy || (isPay && !state.where)}
                onPress={() => press(i.ref, i)}
                profile={profile}
              />
            );
          }}
        />
      ))}
      <p className="mock">💡 {ui.payMock}</p>
    </>
  );
}

function DoneScreen({ state, spec, profile, press, busy }: ScreenProps) {
  const ui = t(profile.lang);
  const items = spec.spec.sections.flatMap((s) => s.items);
  return (
    <>
      <div className="orderno">
        <div>{ui.orderNo}</div>
        <b>{state.orderNo}</b>
      </div>
      {items.map((i) => (
        <Btn key={i.ref} item={i} disabled={busy} onPress={() => press(i.ref, i)} profile={profile} />
      ))}
    </>
  );
}
