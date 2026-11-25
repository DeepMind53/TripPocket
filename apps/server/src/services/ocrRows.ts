/**
 * 영수증 글자 상자 → 보이는 줄 그대로 다시 묶기 (2026-11-12 사용자 제보 "구매 내역이 잘 안 불러와짐").
 * Google Vision·Azure Read는 영수증을 열(품목 이름 열·금액 열) 단위로 읽어, 이름 줄들 다음에 금액 줄들이 따로 나온다.
 * 같은 높이에 있는 글자를 한 줄로 모으면 "라멘 ¥980"처럼 이름과 금액이 다시 한 줄이 된다.
 * 사진을 살짝 기울여 찍어도 되게, 글자 상자의 기울기 가운데값만큼 되돌린 뒤 묶는다
 */
import type { OcrRow } from '@trippocket/shared';

export interface Pt {
  x: number;
  y: number;
}
export interface TextBox {
  text: string;
  /** 왼쪽 위부터 시계 방향 네 점 (글자 방향 기준) */
  poly: readonly Pt[];
}

interface Placed {
  text: string;
  cx: number;
  cy: number;
  left: number;
  right: number;
  h: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

function median(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function rowsFromBoxes(boxes: readonly TextBox[]): string {
  return rowBoxes(boxes)
    .map((r) => r.text)
    .join('\n');
}

/**
 * 줄마다 글과 사진 속 자리 (사진 위에 번역 덮기, 2026-11-25 사용자 요청 "글씨만 따로 보면 헷갈림").
 * box = 사진 픽셀 기준 가운데(cx, cy)·폭·높이·기울기(라디안) — 사진 좌표일 뿐 사용자 위치와는 상관없다
 */
export function rowBoxes(boxes: readonly TextBox[]): OcrRow[] {
  const ok = boxes.filter((b) => b.text.trim() && b.poly.length >= 4);
  if (!ok.length) return [];
  // 글자 방향 (왼쪽 위 → 오른쪽 위)의 가운데값 = 사진 기울기
  const angle = median(
    ok.map((b) => Math.atan2(b.poly[1]!.y - b.poly[0]!.y, b.poly[1]!.x - b.poly[0]!.x)),
  );
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rot = (p: Pt): Pt => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

  const placed: Placed[] = ok.map((b) => {
    const p = b.poly.slice(0, 4).map(rot);
    const xs = p.map((q) => q.x);
    const ys = p.map((q) => q.y);
    const h = Math.max(1, (dist(b.poly[0]!, b.poly[3]!) + dist(b.poly[1]!, b.poly[2]!)) / 2);
    return {
      text: b.text.trim(),
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      left: Math.min(...xs),
      right: Math.max(...xs),
      h,
    };
  });

  // 위에서 아래로 보며, 가운데 높이가 글자 높이 절반 안이면 같은 줄
  placed.sort((a, b) => a.cy - b.cy);
  const rows: { cy: number; h: number; items: Placed[] }[] = [];
  for (const p of placed) {
    let best: (typeof rows)[number] | null = null;
    let bestGap = Infinity;
    for (const r of rows.slice(-3)) {
      const gap = Math.abs(r.cy - p.cy);
      if (gap < 0.5 * Math.max(r.h, p.h) && gap < bestGap) {
        best = r;
        bestGap = gap;
      }
    }
    if (best) {
      const n = best.items.push(p);
      best.cy += (p.cy - best.cy) / n;
      best.h += (p.h - best.h) / n;
    } else rows.push({ cy: p.cy, h: p.h, items: [p] });
  }

  // 되돌린 좌표 → 사진 좌표 (기울기만큼 다시 돌림)
  const back = (p: Pt): Pt => ({
    x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
  });
  const round = (n: number) => Math.round(n * 10) / 10;
  return rows.map((r) => {
    const items = [...r.items].sort((a, b) => a.cx - b.cx);
    let line = items[0]!.text;
    for (let i = 1; i < items.length; i++) {
      // 붙어 있는 글자(일본어·중국어 한 글자씩 온 경우)는 띄우지 않는다.
      // 영문·숫자 낱말끼리는 늘 띄운다 — 인식 서비스가 낱말마다 따로 주는데, 작은 글자는 간격이 좁아
      // "EASYCARD COMF"가 "EASYCARDCOMF"로 붙었다 (2026-11-25 점검)
      const gap = items[i]!.left - items[i - 1]!.right;
      const latin = /[A-Za-z0-9]$/.test(line) && /^[A-Za-z0-9]/.test(items[i]!.text);
      line += (latin || gap > 0.3 * r.h ? ' ' : '') + items[i]!.text;
    }
    const left = Math.min(...items.map((p) => p.left));
    const right = Math.max(...items.map((p) => p.right));
    const c = back({ x: (left + right) / 2, y: r.cy });
    return {
      text: line,
      box: {
        cx: round(c.x),
        cy: round(c.y),
        w: round(right - left),
        h: round(r.h),
        a: Math.round(angle * 1000) / 1000,
      },
    };
  });
}

/** Google Vision 꼭짓점 (0인 값은 응답에서 빠진다) */
export const gPoly = (v: readonly { x?: number; y?: number }[] | undefined): Pt[] =>
  (v ?? []).map((p) => ({ x: p.x ?? 0, y: p.y ?? 0 }));

/** Azure 꼭짓점 — [{x,y}…] 또는 [x1,y1,x2,y2…] */
export function aPoly(v: readonly unknown[] | undefined): Pt[] {
  if (!v?.length) return [];
  if (typeof v[0] === 'number') {
    const n = v as number[];
    const out: Pt[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i]!, y: n[i + 1]! });
    return out;
  }
  return (v as { x?: number; y?: number }[]).map((p) => ({ x: p.x ?? 0, y: p.y ?? 0 }));
}
