// GET /api/health → 배포 상태 확인 (AI 공급자·모델·저장소 종류) · ?models=1 이면 쓸 수 있는 Flash 모델 목록도
import { dailyLimit, todayKey } from '../server/adaptService.js';
import { getProvider, listGeminiModels } from '../server/ai.js';
import { handler, query, send } from '../server/http.js';
import { getKV } from '../server/kv.js';
import { PROMPT_VERSION } from '../server/prompt.js';

export default handler(['GET'], async (req, res) => {
  const kv = getKV();
  const ai = getProvider();
  const used = (await kv.get<number>(`aibudget:${todayKey()}`)) ?? 0;
  const models = query(req).get('models') === '1' && ai?.name === 'gemini' ? await listGeminiModels() : undefined;
  send(res, 200, {
    ok: true,
    provider: ai?.name ?? 'none',
    model: ai?.model() ?? 'none',
    storage: kv.kind,
    promptVersion: PROMPT_VERSION,
    aiCallsToday: used,
    aiDailyLimit: dailyLimit(),
    evalKeyRequired: Boolean(process.env.EVAL_KEY),
    ...(models ? { availableModels: models } : {}),
  });
});
