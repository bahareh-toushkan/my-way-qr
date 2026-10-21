// POST /api/adapt {store, screenKey, profile, noCache?, evalKey?} → '내 방식' 화면 (AI 변환 + 검증)
import { normalizeProfile } from '../shared/profile';
import { SCREEN_KEYS, STORE_IDS, type ScreenKey, type StoreId } from '../shared/types';
import { adaptScreen } from '../server/adaptService';
import { getProvider } from '../server/ai';
import { evalKeyOk, handler, HttpError, rateLimit, readJson, send } from '../server/http';
import { getKV } from '../server/kv';

export default handler(['POST'], async (req, res) => {
  const kv = getKV();
  const body = await readJson(req);
  const isEval = body.noCache === true;
  if (isEval && !evalKeyOk(body.evalKey)) throw new HttpError(403, '측정용 암호가 맞지 않아요');
  await rateLimit(kv, req, isEval ? 'adapt-eval' : 'adapt', isEval ? 120 : 30);
  if (!(STORE_IDS as string[]).includes(body.store as string)) throw new HttpError(400, '매장 값이 올바르지 않아요');
  if (!(SCREEN_KEYS as string[]).includes(body.screenKey as string)) throw new HttpError(400, '화면 값이 올바르지 않아요');
  const result = await adaptScreen(
    {
      store: body.store as StoreId,
      screenKey: body.screenKey as ScreenKey,
      profile: normalizeProfile(body.profile),
      noCache: isEval,
    },
    { kv, ai: getProvider() },
  );
  send(res, 200, result);
});
