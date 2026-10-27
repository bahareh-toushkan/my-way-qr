// POST /api/action {s, ref, actor} → 키오스크·휴대폰 버튼을 모의 주문 서버에 반영
import type { Actor } from '../shared/types.js';
import { handler, HttpError, rateLimit, readJson, send } from '../server/http.js';
import { getKV } from '../server/kv.js';
import { act, isValidId } from '../server/sessions.js';

export default handler(['POST'], async (req, res) => {
  const kv = getKV();
  await rateLimit(kv, req, 'action', 120);
  const body = await readJson(req);
  const id = body.s;
  const ref = body.ref;
  const actor: Actor = body.actor === 'phone' ? 'phone' : 'kiosk';
  if (!isValidId(id)) throw new HttpError(400, '세션 번호가 올바르지 않아요');
  if (typeof ref !== 'string' || ref.length > 60) throw new HttpError(400, '버튼 값이 올바르지 않아요');
  const { state, error } = await act(kv, id, ref, actor);
  send(res, error ? 409 : 200, { state, error });
});
