// POST /api/session {store} → 새 키오스크 세션 · GET /api/session?s=ID → 현재 상태
import { STORE_IDS, type StoreId } from '../shared/types';
import { handler, HttpError, query, rateLimit, readJson, send } from '../server/http';
import { getKV } from '../server/kv';
import { createNew, isValidId, load } from '../server/sessions';

export default handler(['GET', 'POST'], async (req, res) => {
  const kv = getKV();
  if (req.method === 'POST') {
    await rateLimit(kv, req, 'session', 20);
    const body = await readJson(req);
    const store = (STORE_IDS as string[]).includes(body.store as string) ? (body.store as StoreId) : 'cafe';
    send(res, 200, { state: await createNew(kv, store) });
    return;
  }
  const id = query(req).get('s');
  if (!isValidId(id)) throw new HttpError(400, '세션 번호가 올바르지 않아요');
  send(res, 200, { state: await load(kv, id) });
});
