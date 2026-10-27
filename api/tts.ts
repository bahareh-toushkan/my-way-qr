// POST /api/tts {text, voice?} → audio/wav — 데모 영상 내레이션 제작용 임시 기능 (Gemini TTS). 영상 완성 후 삭제 예정.
import { dailyLimit, todayKey } from '../server/adaptService.js';
import { handler, HttpError, rateLimit, readJson } from '../server/http.js';
import { getKV } from '../server/kv.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];

/** 16비트 모노 PCM → WAV */
function toWav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export default handler(['POST'], async (req, res) => {
  const kv = getKV();
  await rateLimit(kv, req, 'tts', 12);
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'AI 키가 없어요');
  const b = await readJson(req);
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text || text.length > 1200) throw new HttpError(400, '문장은 1~1200자');
  const voice = typeof b.voice === 'string' && /^[A-Za-z]{2,20}$/.test(b.voice) ? b.voice : 'Sulafat';
  const style = typeof b.style === 'string' ? b.style.slice(0, 200) : 'Read this as a calm, warm, clear Korean documentary narrator, at a relaxed pace:';
  if ((await kv.incr(`aibudget:${todayKey()}`, 60 * 60 * 48)) > dailyLimit()) throw new HttpError(429, '오늘 AI 한도를 넘었어요');

  let lastErr = '';
  for (const model of MODELS) {
    const r = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${style}\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    const body = await r.text();
    if (r.status === 404 || r.status === 429) {
      lastErr = `${model}: ${r.status}`; // 없거나 무료 한도 초과 → 다음 TTS 모델
      continue;
    }
    if (!r.ok) throw new HttpError(502, `TTS 실패 ${r.status} (${model}): ${body.slice(0, 200)}`);
    const data = JSON.parse(body);
    const part = (data?.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: unknown }) => p.inlineData);
    if (!part) throw new HttpError(502, `TTS 응답에 소리가 없음 (${model})`);
    const mime: string = part.inlineData.mimeType ?? '';
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
    const wav = mime.includes('wav') ? Buffer.from(part.inlineData.data, 'base64') : toWav(Buffer.from(part.inlineData.data, 'base64'), rate);
    res.statusCode = 200;
    res.setHeader('content-type', 'audio/wav');
    res.setHeader('x-tts-model', model);
    res.setHeader('cache-control', 'no-store');
    res.end(wav);
    return;
  }
  throw new HttpError(502, `쓸 수 있는 TTS 모델이 없음 (${lastErr})`);
});
