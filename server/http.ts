// Vercel 함수와 로컬 개발 서버에서 똑같이 쓰는 최소 HTTP 도우미 (Node req/res만 사용)
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { KV } from './kv';

export type Req = IncomingMessage & { body?: unknown };
export type Res = ServerResponse;

export async function readJson(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body as Record<string, unknown>;
  if (typeof req.body === 'string') return safeParse(req.body);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 64 * 1024) throw new HttpError(413, '요청이 너무 큼');
    chunks.push(c as Buffer);
  }
  return safeParse(Buffer.concat(chunks).toString('utf8'));
}

function safeParse(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'JSON 형식이 아님');
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function send(res: Res, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function query(req: Req): URLSearchParams {
  return new URL(req.url ?? '/', 'http://local').searchParams;
}

export function clientIp(req: Req): string {
  const xf = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : xf)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/** 고정 창 요청 제한. 넘으면 429 */
export async function rateLimit(kv: KV, req: Req, bucket: string, limit: number, windowSec = 60) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const n = await kv.incr(`rl:${bucket}:${clientIp(req)}:${win}`, windowSec + 5);
  if (n > limit) throw new HttpError(429, '요청이 너무 많아요. 잠시 후 다시 해 주세요.');
}

export function evalKeyOk(provided: unknown): boolean {
  const need = process.env.EVAL_KEY;
  if (!need) return true;
  return typeof provided === 'string' && provided === need;
}

/** 공통 처리: 메서드 확인 + 오류를 JSON으로 */
export function handler(methods: string[], fn: (req: Req, res: Res) => Promise<void>) {
  return async (req: Req, res: Res) => {
    try {
      if (!methods.includes(req.method ?? 'GET')) throw new HttpError(405, '허용되지 않는 메서드');
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) send(res, e.status, { error: e.message });
      else {
        console.error(e);
        send(res, 500, { error: '서버 오류' });
      }
    }
  };
}
