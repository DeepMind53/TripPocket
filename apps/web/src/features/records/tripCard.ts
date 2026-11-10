import { DAY_INK_HEX, DAY_LINE_HEX } from '../../shared/ui/routeColor';

export interface TripCardData {
  title: string;
  /** "도쿄 · 오사카" */
  cities: string;
  /** "2026.11.12 – 11.16" */
  range: string;
  /** 아래 세 칸 (이름, 값) — 문구는 부르는 쪽이 i18n으로 */
  facts: readonly (readonly [string, string])[];
  /** 일차 수 — 위 노선 막대 칸 수 */
  days: number;
  brand: string;
}

/** "2026.11.12 – 11.16" (해가 바뀌면 끝도 연도까지) */
export function tripRange(start: string, end: string): string {
  const dot = (d: string) => d.replace(/-/g, '.');
  return `${dot(start)} – ${start.slice(0, 4) === end.slice(0, 4) ? dot(end.slice(5)) : dot(end)}`;
}

const W = 360;
const H = 220;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 여행 요약 카드 (실험실 tripCard, 2026-11-10): 탑승권 모양 한 장 — 위 노선 막대(일차 색), 제목·도시·날짜,
 * 절취선 아래 사실 세 칸. 그림으로 바꿔 저장하므로 실제 색 값 (화면 라이트 토큰과 같게)
 */
export function tripCardSvg(d: TripCardData): string {
  const sans = 'system-ui, sans-serif';
  const mono = "'JetBrains Mono', ui-monospace, monospace";
  const n = Math.max(1, Math.min(d.days, 16));
  const segW = (W - 48) / n;
  const bar = Array.from(
    { length: n },
    (_, i) =>
      `<rect x="${24 + i * segW}" y="24" width="${Math.max(segW - 3, 2)}" height="5" rx="2.5" fill="${DAY_LINE_HEX[i % 8]}"/>`,
  ).join('');
  const colW = (W - 48) / Math.max(1, d.facts.length);
  const facts = d.facts
    .map(
      ([k, v], i) =>
        `<text x="${24 + i * colW}" y="176" font-family="${sans}" font-size="11" fill="#6b7280">${esc(k)}</text>` +
        `<text x="${24 + i * colW}" y="198" font-family="${mono}" font-size="16" font-weight="500" fill="#1f2328">${esc(v)}</text>`,
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 32}" height="${H + 32}" viewBox="0 0 ${W + 32} ${H + 32}">` +
    `<rect width="${W + 32}" height="${H + 32}" fill="#f7f4ee"/>` +
    `<g transform="translate(16 16)">` +
    // 카드 + 절취선 양옆 반원 홈
    `<mask id="m"><rect width="${W}" height="${H}" rx="16" fill="#fff"/><circle cx="0" cy="148" r="9" fill="#000"/><circle cx="${W}" cy="148" r="9" fill="#000"/></mask>` +
    `<rect width="${W}" height="${H}" rx="16" fill="#ffffff" stroke="#e5e2dc" mask="url(#m)"/>` +
    bar +
    `<text x="24" y="66" font-family="${sans}" font-size="20" font-weight="600" fill="#1f2328">${esc(d.title)}</text>` +
    `<text x="24" y="92" font-family="${sans}" font-size="13" fill="#4b5563">${esc(d.cities)}</text>` +
    `<text x="24" y="116" font-family="${mono}" font-size="13" fill="${DAY_INK_HEX[0]}">${esc(d.range)}</text>` +
    `<line x1="16" y1="148" x2="${W - 16}" y2="148" stroke="#d6d3cd" stroke-dasharray="4 4"/>` +
    facts +
    `<text x="${W - 24}" y="66" text-anchor="end" font-family="${mono}" font-size="11" fill="#9ca3af">${esc(d.brand)}</text>` +
    '</g></svg>'
  );
}
