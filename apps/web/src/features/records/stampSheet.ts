import { stampLook } from '../../shared/ui';
import { dayInkHex } from '../../shared/ui/routeColor';

export interface SheetStamp {
  city: string;
  period: string;
  seed: string;
}

const CELL = 120;
const COLS = 3;
const PAD = 24;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 여권 도장 이미지 (실험실 stampImage, 2026-11-10): 기록 탭 도장을 종이색 한 장 SVG로.
 * 화면의 Stamp와 같은 모양·기울기·노선 색. 그림으로 바꿔 저장하므로 CSS 변수 대신 실제 색 값
 */
export function stampSheetSvg(stamps: readonly SheetStamp[], title: string): string {
  const rows = Math.max(1, Math.ceil(stamps.length / COLS));
  const w = PAD * 2 + CELL * COLS;
  const h = PAD * 2 + 32 + CELL * rows;
  const font = "'JetBrains Mono', ui-monospace, monospace";
  const cells = stamps.map((s, i) => {
    const { round, rotate, size } = stampLook(s.seed, s.city);
    const x = PAD + (i % COLS) * CELL + (CELL - 96) / 2;
    const y = PAD + 32 + Math.floor(i / COLS) * CELL + (CELL - 96) / 2;
    const shape = round
      ? '<circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".85"/>' +
        '<circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3" opacity=".6"/>'
      : '<rect x="6" y="14" width="68" height="52" rx="10" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".85"/>' +
        '<rect x="11" y="19" width="58" height="42" rx="7" fill="none" stroke="currentColor" stroke-width="1" opacity=".6"/>';
    return (
      `<g transform="translate(${x} ${y}) scale(1.2) rotate(${rotate} 40 40)" color="${dayInkHex(i)}">` +
      shape +
      `<text x="40" y="39" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="500" fill="currentColor" letter-spacing="1">${esc(s.city.toUpperCase())}</text>` +
      `<text x="40" y="53" text-anchor="middle" font-family="${font}" font-size="8.5" fill="currentColor" opacity=".85">${esc(s.period)}</text>` +
      '</g>'
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#f7f4ee"/>` +
    `<text x="${PAD}" y="${PAD + 16}" font-family="system-ui, sans-serif" font-size="16" font-weight="500" fill="#3a3f47">${esc(title)}</text>` +
    cells.join('') +
    '</svg>'
  );
}

/** SVG 글 → PNG (2배 크기, 휴대폰 화면에서 선명하게) */
export async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error('no png'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
