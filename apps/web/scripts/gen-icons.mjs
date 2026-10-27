// 앱 아이콘 생성: public/icons/*.svg → PNG (홈 화면·설치용). 이미 있는 Playwright 브라우저로 그린다.
//   node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

/** 파란 바탕 + 흰 지도 핀 + 점선 비행 경로·비행기 (홈 로고와 같은 모양). pad = 안전 여백 비율(maskable) */
const svg = (pad, rounded) => {
  const s = 512;
  const inner = s * (1 - pad * 2);
  const k = inner / 512;
  const o = s * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="#2f6bff"/>
  <g transform="translate(${o} ${o}) scale(${k})">
    <path d="M70 330 C 130 120, 330 70, 440 150" fill="none" stroke="#ffffff" stroke-opacity=".75"
      stroke-width="16" stroke-linecap="round" stroke-dasharray="2 34"/>
    <path d="M36 0C36-4 30-6 24-6H12L-6-34H-16L-4-6H-20L-28-18H-36L-30 0L-36 18H-28L-20 6H-4L-16 34H-6L12 6H24C30 6 36 4 36 0Z" transform="translate(446 150) rotate(35) scale(1.25)" fill="#ffffff"/>
    <path d="M256 112c-62 0-112 50-112 112 0 86 112 196 112 196s112-110 112-196c0-62-50-112-112-112z" fill="#ffffff"/>
    <circle cx="256" cy="224" r="46" fill="#2f6bff"/>
  </g>
</svg>`;
};

const files = {
  'icon.svg': svg(0.06, true),
  'maskable.svg': svg(0.16, false),
};
for (const [name, text] of Object.entries(files)) writeFileSync(new URL(name, out), text);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, src, size] of [
  ['icon-192.png', 'icon.svg', 192],
  ['icon-512.png', 'icon.svg', 512],
  ['maskable-512.png', 'maskable.svg', 512],
  ['apple-touch-icon.png', 'maskable.svg', 180],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(files[src]).toString('base64')}" width="${size}" height="${size}">`,
  );
  writeFileSync(new URL(name, out), await page.screenshot({ omitBackground: true }));
  console.log(name);
}
await browser.close();
