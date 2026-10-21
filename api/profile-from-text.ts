// POST /api/profile-from-text {text, profile} → 사용자가 쓴 문장으로 표시 설정 고르기
import { normalizeProfile } from '../shared/profile';
import { dailyLimit, todayKey } from '../server/adaptService';
import { getProvider } from '../server/ai';
import { handler, HttpError, rateLimit, readJson, send } from '../server/http';
import { getKV } from '../server/kv';
import { profileFromText } from '../server/profileFromText';

export default handler(['POST'], async (req, res) => {
  const kv = getKV();
  await rateLimit(kv, req, 'profile', 10);
  const body = await readJson(req);
  if (typeof body.text !== 'string' || !body.text.trim()) throw new HttpError(400, '문장을 입력해 주세요');
  const current = normalizeProfile(body.profile);
  const used = await kv.incr(`aibudget:${todayKey()}`, 60 * 60 * 48);
  const ai = used > dailyLimit() ? null : getProvider();
  send(res, 200, await profileFromText(body.text, current, ai));
});
