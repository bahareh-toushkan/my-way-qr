// 모의 키오스크 (예시 매장). 일반적인 키오스크 화면 + 구석에 '내 방식으로 주문' QR.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { allowedValues, findGroup, findItem, formatWon, getStore } from '../../shared/catalog';
import { cartCount, cartTotal, isCorrection, lineTotal, unitPrice } from '../../shared/reducer';
import type { StoreId } from '../../shared/types';
import { api } from '../lib/api';
import { useSession } from '../lib/useSession';

export default function Kiosk() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const storeId: StoreId = params.get('store') === 'restaurant' ? 'restaurant' : 'cafe';
  const testMode = params.get('test') === '1';
  const store = getStore(storeId);
  const [sid, setSid] = useState<string | null>(null);
  const { state, gone, send, replace, error } = useSession(sid, 'kiosk', 1000);
  const [qr, setQr] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const creating = useRef(false);

  const newSession = useCallback(async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      const { state: s } = await api.createSession(storeId);
      replace(s);
      setSid(s.id);
    } finally {
      creating.current = false;
    }
  }, [storeId, replace]);

  useEffect(() => {
    newSession();
  }, [newSession]);

  useEffect(() => {
    if (gone) newSession();
  }, [gone, newSession]);

  // 주문이 끝나면 12초 뒤 다음 손님을 위해 새 세션(새 QR)
  useEffect(() => {
    if (state?.step !== 'done') return;
    const t = setTimeout(newSession, 12_000);
    return () => clearTimeout(t);
  }, [state?.step, state?.id, newSession]);

  const phoneUrl = sid ? `${location.origin}/me?s=${sid}${testMode ? '&test=1' : ''}` : '';
  useEffect(() => {
    if (!phoneUrl) return;
    QRCode.toDataURL(phoneUrl, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr);
  }, [phoneUrl]);

  // '담았어요' 알림
  useEffect(() => {
    if (state?.notice?.startsWith('added:')) {
      const it = findItem(store, state.notice.slice(6));
      setToast(it ? `${it.name} 담음` : null);
      const t = setTimeout(() => setToast(null), 1800);
      return () => clearTimeout(t);
    }
  }, [state?.version, state?.notice, store]);

  // 사용자 테스트(원래 화면) 기록: 시간·누른 횟수만
  const metric = useRef<{ start: number; actions: number; corrections: number; sent: boolean } | null>(null);
  useEffect(() => {
    metric.current = null;
  }, [sid]);
  const press = useCallback(
    (ref: string) => {
      if (testMode) {
        if (!metric.current) metric.current = { start: performance.now(), actions: 0, corrections: 0, sent: false };
        metric.current.actions++;
        if (isCorrection(ref)) metric.current.corrections++;
      }
      return send(ref);
    },
    [send, testMode],
  );
  useEffect(() => {
    const m = metric.current;
    if (testMode && state?.step === 'done' && m && !m.sent && !state.phoneJoined) {
      m.sent = true;
      api.metric({ mode: 'original', store: storeId, profileKey: 'kiosk-original', durationMs: performance.now() - m.start, actions: m.actions, corrections: m.corrections, completed: true });
    }
  }, [state?.step, state?.phoneJoined, testMode, storeId]);

  if (!state) return <div className="kiosk-boot">키오스크 준비 중…</div>;

  const items = store.items.filter((i) => i.category === state.category);
  const draftItem = state.draft ? findItem(store, state.draft.itemId) : undefined;
  const count = cartCount(state);
  const total = cartTotal(state);

  return (
    <div className="kiosk">
      <header className="k-head">
        <div className="k-brand">
          <span className="k-logo">{storeId === 'cafe' ? '☕' : '🍚'}</span>
          <strong>{store.name}</strong>
          <span className="k-tag">예시 매장 · 시연용</span>
          {testMode && <span className="k-tag test">🧪 테스트 모드</span>}
        </div>
        <button className="k-staff" onClick={() => press('staff')}>
          직원 호출
        </button>
      </header>

      {state.phoneJoined && state.step !== 'done' && (
        <div className="k-banner phone">📱 손님이 휴대폰으로 주문하는 중이에요 — 이 화면도 함께 바뀌어요</div>
      )}
      {state.staffCalled && (
        <div className="k-banner staff">
          🙋 직원 호출: 손님이 도움을 요청했어요
          <button onClick={() => send('staff:done')}>확인</button>
        </div>
      )}

      <div className="k-body">
        <main className="k-main">
          <nav className="k-cats">
            {store.categories.map((c) => (
              <button key={c.id} className={c.id === state.category ? 'on' : ''} onClick={() => press(`cat:${c.id}`)}>
                {c.label}
              </button>
            ))}
          </nav>
          <div className="k-grid">
            {items.map((it) => (
              <button key={it.id} className="k-card" onClick={() => press(`item:${it.id}`)}>
                <span className="k-icon">{it.icon}</span>
                <span className="k-name">{it.name}</span>
                <span className="k-price">{formatWon(it.price)}</span>
              </button>
            ))}
          </div>
        </main>

        <aside className="k-side">
          <div className="k-qr">
            <div className="k-qr-title">📱 내 방식으로 주문하기</div>
            {qr ? <img src={qr} alt="휴대폰으로 찍으면 내 방식 주문 화면이 열리는 QR 코드" /> : <div className="k-qr-ph" />}
            <div className="k-qr-text">
              QR을 찍으면 <b>내 휴대폰</b>에서 큰 글씨·쉬운 말·읽어 주기·다른 언어로 주문할 수 있어요
            </div>
            <div className="k-qr-langs">Order your way · 按我的方式点餐 · Gọi món theo cách của bạn · سفارش به روش من</div>
            <div className="k-qr-code">세션 {sid}</div>
          </div>

          <div className="k-cart">
            <div className="k-cart-title">
              주문 내역 <span>{count}개</span>
            </div>
            <ul>
              {state.cart.map((l) => {
                const it = findItem(store, l.itemId);
                return (
                  <li key={l.lineId}>
                    <span>
                      {it?.name} × {l.qty}
                    </span>
                    <span>{formatWon(lineTotal(store, l))}</span>
                  </li>
                );
              })}
            </ul>
            <div className="k-total">
              합계 <b>{formatWon(total)}</b>
            </div>
            <button className="k-pay" disabled={count === 0} onClick={() => press('nav:cart')}>
              결제하기
            </button>
          </div>
        </aside>
      </div>

      {toast && <div className="k-toast">{toast}</div>}
      {error && <div className="k-error">{error}</div>}

      {state.step === 'options' && draftItem && state.draft && (
        <div className="k-modal">
          <div className="k-dialog">
            <h2>
              {draftItem.icon} {draftItem.name} <small>{formatWon(unitPrice(store, draftItem.id, state.draft.options))}</small>
            </h2>
            {draftItem.groups.map((gid) => {
              const g = findGroup(store, gid)!;
              return (
                <div className="k-opt" key={gid}>
                  <div className="k-opt-label">{g.label}</div>
                  <div className="k-opt-values">
                    {allowedValues(store, draftItem, gid).map((v) => (
                      <button key={v.id} className={state.draft!.options[gid] === v.id ? 'on' : ''} onClick={() => press(`opt:${gid}:${v.id}`)}>
                        {v.label}
                        {v.extra > 0 && <small> +{v.extra.toLocaleString('ko-KR')}</small>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="k-qty">
              <button onClick={() => press('qty:-')}>−</button>
              <span>{state.draft.qty}</span>
              <button onClick={() => press('qty:+')}>+</button>
            </div>
            <div className="k-actions">
              <button className="ghost" onClick={() => press('back')}>
                취소
              </button>
              <button className="primary" onClick={() => press('add')}>
                {formatWon(unitPrice(store, draftItem.id, state.draft.options) * state.draft.qty)} 담기
              </button>
            </div>
          </div>
        </div>
      )}

      {state.step === 'cart' && (
        <div className="k-modal">
          <div className="k-dialog">
            <h2>주문 확인</h2>
            {state.cart.length === 0 && <p className="k-empty">담은 메뉴가 없습니다</p>}
            <ul className="k-lines">
              {state.cart.map((l) => {
                const it = findItem(store, l.itemId);
                const opts = Object.entries(l.options)
                  .map(([g, v]) => findGroup(store, g)?.values.find((x) => x.id === v)?.label)
                  .filter(Boolean)
                  .join(' / ');
                return (
                  <li key={l.lineId}>
                    <div>
                      <b>{it?.name}</b>
                      <small>{opts}</small>
                    </div>
                    <div className="k-line-ctl">
                      <button onClick={() => press(`line:${l.lineId}:-`)}>−</button>
                      <span>{l.qty}</span>
                      <button onClick={() => press(`line:${l.lineId}:+`)}>+</button>
                      <button className="del" onClick={() => press(`line:${l.lineId}:del`)}>
                        삭제
                      </button>
                    </div>
                    <span className="k-line-price">{formatWon(lineTotal(store, l))}</span>
                  </li>
                );
              })}
            </ul>
            <div className="k-total big">
              합계 <b>{formatWon(total)}</b>
            </div>
            <div className="k-actions">
              <button className="ghost" onClick={() => press('cancel')}>
                전체 취소
              </button>
              <button className="ghost" onClick={() => press('more')}>
                추가 주문
              </button>
              <button className="primary" disabled={count === 0} onClick={() => press('checkout')}>
                결제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {state.step === 'pay' && (
        <div className="k-modal">
          <div className="k-dialog">
            <h2>결제</h2>
            <div className="k-opt">
              <div className="k-opt-label">식사 장소</div>
              <div className="k-opt-values">
                <button className={state.where === 'here' ? 'on' : ''} onClick={() => press('where:here')}>
                  매장
                </button>
                <button className={state.where === 'togo' ? 'on' : ''} onClick={() => press('where:togo')}>
                  포장
                </button>
              </div>
            </div>
            <div className="k-opt">
              <div className="k-opt-label">결제 수단</div>
              <div className="k-opt-values">
                <button disabled={!state.where} onClick={() => press('pay:card')}>
                  💳 신용카드
                </button>
                <button disabled={!state.where} onClick={() => press('pay:mobile')}>
                  📱 간편결제
                </button>
              </div>
            </div>
            <div className="k-total big">
              결제 금액 <b>{formatWon(total)}</b>
            </div>
            <p className="k-note">시연용 모의 결제입니다. 실제 결제는 일어나지 않습니다.</p>
            <div className="k-actions">
              <button className="ghost" onClick={() => press('back')}>
                이전
              </button>
            </div>
          </div>
        </div>
      )}

      {state.step === 'done' && (
        <div className="k-modal">
          <div className="k-dialog center">
            <div className="k-done-icon">✅</div>
            <h2>결제가 완료되었습니다 (모의)</h2>
            <div className="k-orderno">
              주문번호 <b>{state.orderNo}</b>
            </div>
            <p>잠시 후 처음 화면으로 돌아갑니다</p>
          </div>
        </div>
      )}
    </div>
  );
}
