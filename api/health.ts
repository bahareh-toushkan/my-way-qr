// GET /api/health → 배포 상태 확인 (AI 공급자·모델·저장소 종류)
import { dailyLimit, todayKey } from '../server/adaptService.js';
import { getProvider } from '../server/ai.js';
import { handler, send } from '../server/http.js';
import { getKV } from '../server/kv.js';
import { PROMPT_VERSION } from '../server/prompt.js';

export default handler(['GET'], async (_req, res) => {
  const kv = getKV();
  const ai = getProvider();
  const used = (await kv.get<number>(`aibudget:${todayKey()}`)) ?? 0;
  send(res, 200, {
    ok: true,
    provider: ai?.name ?? 'none',
    model: ai?.model() ?? 'none',
    storage: kv.kind,
    promptVersion: PROMPT_VERSION,
    aiCallsToday: used,
    aiDailyLimit: dailyLimit(),
    evalKeyRequired: Boolean(process.env.EVAL_KEY),
  });
});
