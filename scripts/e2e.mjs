// 끝까지 주문 흐름 점검 (로컬, mock AI): 키오스크 → QR 주소 → 휴대폰 설정 → 주문 → 키오스크에 반영
// 사용: AI_PROVIDER=mock npx vite --port 5199 & → node scripts/e2e.mjs http://localhost:5199
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const OUT = new URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
const kioskCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
const errors = [];
const watch = (page, name) => {
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
};

const kiosk = await kioskCtx.newPage();
watch(kiosk, 'kiosk');
await kiosk.goto(`${BASE}/kiosk`);
await kiosk.waitForSelector('.k-qr img');
const sid = (await kiosk.textContent('.k-qr-code')).replace('세션', '').trim();
console.log('session', sid);
await kiosk.screenshot({ path: `${OUT}01-kiosk.png` });

const phone = await phoneCtx.newPage();
watch(phone, 'phone');
await phone.goto(`${BASE}/me?s=${sid}`);
await phone.waitForSelector('.setup');
await phone.getByRole('button', { name: '글씨가 잘 안 보여요' }).click();
await phone.getByRole('button', { name: '쉬운 말' }).click();
await phone.screenshot({ path: `${OUT}02-setup.png`, fullPage: true });
await phone.getByRole('button', { name: /이 방식으로 시작/ }).click();

await phone.waitForSelector('.me-body .btn.item', { timeout: 30000 });
await phone.screenshot({ path: `${OUT}03-menu.png`, fullPage: true });
await kiosk.waitForSelector('.k-banner.phone');
await kiosk.screenshot({ path: `${OUT}04-kiosk-joined.png` });

// 카페라떼 고르기 (아주 큰 글씨: 한 화면 4개 → 더 보기)
const latte = phone.locator('.btn.item', { hasText: '카페라떼' });
await latte.first().click();
await phone.waitForSelector('.chosen');
await phone.locator('.btn.item', { hasText: 'ICE' }).first().click();
await phone.waitForFunction(() => document.querySelector('.btn.item.on')?.textContent?.includes('ICE'));
await phone.screenshot({ path: `${OUT}05-options.png`, fullPage: true });
await phone.locator('.btn.item', { hasText: '담기' }).first().click();
await phone.waitForSelector('.toast');
await kiosk.waitForFunction(() => document.querySelector('.k-cart-title span')?.textContent === '1개');

// 장바구니 → 결제
await phone.locator('.btn.item', { hasText: '장바구니' }).first().click();
await phone.waitForSelector('.lines .line');
await phone.screenshot({ path: `${OUT}06-cart.png`, fullPage: true });
await phone.locator('.btn.item', { hasText: '결제하기' }).first().click();
await phone.waitForSelector('text=먼저 매장에서 먹을지');
await phone.locator('.btn.item', { hasText: '포장' }).first().click();
await phone.waitForFunction(() => !document.querySelector('.me .note')?.textContent?.includes('먼저'));
await phone.screenshot({ path: `${OUT}07-pay.png`, fullPage: true });
await kiosk.screenshot({ path: `${OUT}08-kiosk-pay.png` });
await phone.locator('.btn.item', { hasText: '간편결제' }).first().click();
await phone.waitForSelector('.orderno');
const orderNo = await phone.textContent('.orderno b');
await kiosk.waitForSelector('.k-orderno');
const kioskNo = await kiosk.textContent('.k-orderno b');
await phone.screenshot({ path: `${OUT}09-done.png`, fullPage: true });
await kiosk.screenshot({ path: `${OUT}10-kiosk-done.png` });
console.log('orderNo phone/kiosk', orderNo, kioskNo);
if (orderNo !== kioskNo) throw new Error('주문번호가 다름');

// 다른 언어·고대비 화면 (새 세션)
for (const [name, profile] of [
  ['en', { v: 1, lang: 'en', text: 'large', touch: 'large', words: 'easy', detail: 'step', voice: true, contrast: 'normal' }],
  ['fa-hc', { v: 1, lang: 'fa', text: 'xlarge', touch: 'large', words: 'easy', detail: 'step', voice: false, contrast: 'high' }],
]) {
  const s = await (await fetch(`${BASE}/api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ store: 'restaurant' }) })).json();
  const p = await phoneCtx.newPage();
  watch(p, name);
  await p.addInitScript((prof) => localStorage.setItem('myway.profile.v1', JSON.stringify(prof)), profile);
  await p.goto(`${BASE}/me?s=${s.state.id}`);
  await p.waitForSelector('.me-body .btn.item', { timeout: 30000 });
  await p.screenshot({ path: `${OUT}11-${name}.png`, fullPage: true });
  await p.close();
}

await kioskCtx.close();
await phoneCtx.close();
await browser.close();
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('E2E OK');
