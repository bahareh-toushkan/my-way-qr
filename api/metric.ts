// POST /api/metric → 사용자 테스트 기록(익명: 시간·동작 수만) · GET /api/metric?key= → 기록 보기
import { STORE_IDS, type MetricRecord, type StoreId } from '../shared/types.js';
import { evalKeyOk, handler, HttpError, query, rateLimit, readJson, send } from '../server/http.js';
import { getKV } from '../server/kv.js';

const KEY = 'metrics:v1';

function num(v: unknown, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : 0;
}

export default handler(['GET', 'POST'], async (req, res) => {
  const kv = getKV();
  if (req.method === 'GET') {
    if (!evalKeyOk(query(req).get('key'))) throw new HttpError(403, '암호가 맞지 않아요');
    send(res, 200, { records: await kv.list<MetricRecord>(KEY, 1000) });
    return;
  }
  await rateLimit(kv, req, 'metric', 30);
  const b = await readJson(req);
  const rec: MetricRecord = {
    mode: b.mode === 'original' ? 'original' : 'adapted',
    store: (STORE_IDS as string[]).includes(b.store as string) ? (b.store as StoreId) : 'cafe',
    profileKey: typeof b.profileKey === 'string' ? b.profileKey.slice(0, 80) : '',
    durationMs: num(b.durationMs, 60 * 60 * 1000),
    actions: num(b.actions, 1000),
    corrections: num(b.corrections, 1000),
    completed: b.completed === true,
    at: Date.now(),
  };
  await kv.pushCapped(KEY, rec, 1000, 60 * 60 * 24 * 120);
  send(res, 200, { ok: true });
});
