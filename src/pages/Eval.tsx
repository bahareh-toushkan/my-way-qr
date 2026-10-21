// 변환 성공률 측정: (매장 화면 × 대표 프로필 × 반복)을 실제 배포된 API로 돌려 결과를 그대로 기록한다.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { TEST_PROFILES } from '../../shared/profile';
import { SCREEN_KEYS, STORE_IDS, type AdaptResponse, type MetricRecord, type ScreenKey, type StoreId } from '../../shared/types';
import { api } from '../lib/api';
import { sessionGet, sessionSet } from '../lib/storage';

interface Row {
  store: StoreId;
  screen: ScreenKey;
  profile: string;
  rep: number;
  r?: AdaptResponse;
  error?: string;
}

type Health = Awaited<ReturnType<typeof api.health>>;

function pct(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(1)}% (${n}/${d})` : '-';
}

function quantile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function summarize(rows: Row[]) {
  const done = rows.filter((r) => r.r || r.error);
  const ok = done.filter((r) => r.r);
  const first = ok.filter((r) => r.r!.source === 'ai').length;
  const retry = ok.filter((r) => r.r!.source === 'ai-retry').length;
  const fb = ok.filter((r) => r.r!.source === 'fallback').length;
  const lat = ok.filter((r) => r.r!.source !== 'fallback').map((r) => r.r!.latencyMs);
  const codes = new Map<string, number>();
  for (const r of ok) for (const a of r.r!.attempts) for (const c of a.codes) codes.set(c, (codes.get(c) ?? 0) + 1);
  const softFree = ok.filter((r) => r.r!.source !== 'fallback' && r.r!.validation.softCount === 0).length;
  return { total: done.length, errors: done.length - ok.length, first, retry, fb, lat, codes, softFree };
}

export default function Eval() {
  const [health, setHealth] = useState<Health | null>(null);
  const [key, setKey] = useState(() => sessionGet('evalKey'));
  const [stores, setStores] = useState<StoreId[]>(['cafe', 'restaurant']);
  const [screens, setScreens] = useState<ScreenKey[]>([...SCREEN_KEYS]);
  const [profiles, setProfiles] = useState<number[]>(TEST_PROFILES.map((_, i) => i));
  const [reps, setReps] = useState(1);
  const [delayMs, setDelayMs] = useState(8000);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const [metrics, setMetrics] = useState<MetricRecord[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const plan = useMemo(() => {
    const out: Row[] = [];
    for (let rep = 1; rep <= reps; rep++)
      for (const store of stores) for (const screen of screens) for (const pi of profiles) out.push({ store, screen, profile: TEST_PROFILES[pi].name, rep });
    return out;
  }, [stores, screens, profiles, reps]);

  const run = async () => {
    sessionSet('evalKey', key);
    stopRef.current = false;
    setRunning(true);
    const list = plan.map((p) => ({ ...p }));
    setRows(list);
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break;
      const row = list[i];
      const prof = TEST_PROFILES.find((p) => p.name === row.profile)!.profile;
      try {
        row.r = await api.adapt(row.store, row.screen, prof, { noCache: true, evalKey: key });
      } catch (e) {
        row.error = (e as Error).message;
      }
      setRows([...list]);
      if (i < list.length - 1) await new Promise((res) => setTimeout(res, delayMs));
    }
    setRunning(false);
  };

  const s = summarize(rows);
  const notReal = health && health.provider !== 'gemini';

  const csv = () => {
    const head = 'store,screen,profile,rep,source,attempts,hard_codes,soft_count,latency_ms,model,fallback_reason,error';
    const lines = rows.map((r) =>
      [r.store, r.screen, `"${r.profile}"`, r.rep, r.r?.source ?? '', r.r?.attempts.length ?? '', `"${r.r?.attempts.flatMap((a) => a.codes).join(' ') ?? ''}"`, r.r?.validation.softCount ?? '', r.r?.latencyMs ?? '', r.r?.model ?? '', r.r?.fallbackReason ?? '', `"${r.error ?? ''}"`].join(','),
    );
    download(`myway-eval-${Date.now()}.csv`, [head, ...lines].join('\n'), 'text/csv');
  };

  const loadMetrics = async () => {
    sessionSet('evalKey', key);
    try {
      setMetrics((await api.metrics(key)).records);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const mSum = (mode: 'adapted' | 'original') => {
    const xs = (metrics ?? []).filter((m) => m.mode === mode && m.completed);
    if (!xs.length) return '-';
    const avg = (f: (m: MetricRecord) => number) => xs.reduce((a, m) => a + f(m), 0) / xs.length;
    return `${xs.length}건 · 평균 ${(avg((m) => m.durationMs) / 1000).toFixed(1)}초 · 누른 횟수 ${avg((m) => m.actions).toFixed(1)} · 정정 ${avg((m) => m.corrections).toFixed(2)}`;
  };

  return (
    <div className="eval">
      <h1>📊 화면 변환 성공률 측정</h1>
      <p>
        각 조합을 <b>캐시 없이</b> 실제 AI로 변환하고 검증기 결과를 그대로 기록합니다. 숫자는 이 페이지에서 나온 값만 보고서에 씁니다.
      </p>
      <div className={`health ${notReal ? 'warn' : ''}`}>
        {health ? (
          <>
            AI: <b>{health.provider}</b> / {health.model} · 저장소: {health.storage} · 프롬프트 {health.promptVersion} · 오늘 AI 호출 {health.aiCallsToday}/{health.aiDailyLimit}
            {notReal && <div>⚠️ 실제 AI가 아닙니다. 이 결과를 보고서에 쓰면 안 됩니다.</div>}
          </>
        ) : (
          '서버 상태 확인 중…'
        )}
      </div>

      <fieldset>
        <legend>측정 설정</legend>
        {health?.evalKeyRequired && (
          <label>
            측정 암호 <input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
        )}
        <div>
          매장:{' '}
          {STORE_IDS.map((x) => (
            <label key={x}>
              <input type="checkbox" checked={stores.includes(x)} onChange={(e) => setStores((v) => (e.target.checked ? [...v, x] : v.filter((y) => y !== x)))} /> {x}
            </label>
          ))}
        </div>
        <div>
          화면:{' '}
          {SCREEN_KEYS.map((x) => (
            <label key={x}>
              <input type="checkbox" checked={screens.includes(x)} onChange={(e) => setScreens((v) => (e.target.checked ? [...v, x] : v.filter((y) => y !== x)))} /> {x}
            </label>
          ))}
        </div>
        <div>
          프로필:{' '}
          {TEST_PROFILES.map((p, i) => (
            <label key={p.name}>
              <input type="checkbox" checked={profiles.includes(i)} onChange={(e) => setProfiles((v) => (e.target.checked ? [...v, i] : v.filter((y) => y !== i)))} /> {p.name}
            </label>
          ))}
        </div>
        <label>
          반복 <input type="number" min={1} max={5} value={reps} onChange={(e) => setReps(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
        </label>
        <label>
          요청 간격(ms) <input type="number" min={0} step={500} value={delayMs} onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <div className="row">
          <button disabled={running || plan.length === 0} onClick={run}>
            ▶ {plan.length}개 측정 시작
          </button>
          <button disabled={!running} onClick={() => (stopRef.current = true)}>
            ■ 멈추기
          </button>
          <button disabled={!rows.length} onClick={() => download(`myway-eval-${Date.now()}.json`, JSON.stringify({ health, rows }, null, 2), 'application/json')}>
            JSON 저장
          </button>
          <button disabled={!rows.length} onClick={csv}>
            CSV 저장
          </button>
        </div>
      </fieldset>

      {rows.length > 0 && (
        <section className="summary">
          <h2>요약 ({s.total}/{rows.length} 완료)</h2>
          <table>
            <tbody>
              <tr>
                <th>첫 시도에 검증 통과 (AI)</th>
                <td>{pct(s.first, s.total)}</td>
              </tr>
              <tr>
                <th>재시도 포함 검증 통과 (AI)</th>
                <td>{pct(s.first + s.retry, s.total)}</td>
              </tr>
              <tr>
                <th>규칙 기반 화면으로 대체</th>
                <td>{pct(s.fb, s.total)}</td>
              </tr>
              <tr>
                <th>soft 규칙까지 모두 통과 (AI 성공 중)</th>
                <td>{pct(s.softFree, s.first + s.retry)}</td>
              </tr>
              <tr>
                <th>요청 오류</th>
                <td>{s.errors}</td>
              </tr>
              <tr>
                <th>AI 변환 시간 (중앙값 / 95%)</th>
                <td>
                  {(quantile(s.lat, 0.5) / 1000).toFixed(1)}초 / {(quantile(s.lat, 0.95) / 1000).toFixed(1)}초
                </td>
              </tr>
              <tr>
                <th>시도별 문제 코드</th>
                <td>
                  {[...s.codes.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([c, n]) => `${c} ${n}`)
                    .join(' · ') || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {rows.length > 0 && (
        <table className="rows">
          <thead>
            <tr>
              <th>#</th>
              <th>매장</th>
              <th>화면</th>
              <th>프로필</th>
              <th>결과</th>
              <th>시도</th>
              <th>시간</th>
              <th>문제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Fragment key={i}>
                <tr className={r.r?.source === 'fallback' || r.error ? 'bad' : r.r ? 'good' : ''} onClick={() => setOpen(open === i ? null : i)}>
                  <td>{i + 1}</td>
                  <td>{r.store}</td>
                  <td>{r.screen}</td>
                  <td>{r.profile}</td>
                  <td>{r.error ? '오류' : r.r ? r.r.source : running ? '…' : ''}</td>
                  <td>{r.r?.attempts.length ?? ''}</td>
                  <td>{r.r ? `${(r.r.latencyMs / 1000).toFixed(1)}s` : ''}</td>
                  <td>{r.error ?? r.r?.attempts.flatMap((a) => (a.error ? [a.error] : a.codes)).join(' ') ?? ''}</td>
                </tr>
                {open === i && r.r && (
                  <tr>
                    <td colSpan={8}>
                      <pre>{JSON.stringify(r.r, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      <section className="summary">
        <h2>사용자 테스트 기록 (익명)</h2>
        <p>키오스크를 <code>/kiosk?test=1</code>로 열면, 원래 화면 주문과 QR로 연 '내 방식' 주문의 걸린 시간·누른 횟수가 기록됩니다.</p>
        <button onClick={loadMetrics}>기록 불러오기</button>
        {metrics && (
          <table>
            <tbody>
              <tr>
                <th>원래 키오스크 화면</th>
                <td>{mSum('original')}</td>
              </tr>
              <tr>
                <th>내 방식 (휴대폰)</th>
                <td>{mSum('adapted')}</td>
              </tr>
            </tbody>
          </table>
        )}
        {metrics && metrics.length > 0 && (
          <button onClick={() => download(`myway-usertest-${Date.now()}.json`, JSON.stringify(metrics, null, 2), 'application/json')}>기록 JSON 저장</button>
        )}
      </section>
    </div>
  );
}
