import type { ItineraryItem } from '@trippocket/shared';
import { currentItemId } from './dayTools';

/**
 * 영수증 글 → 품목·금액 표 (실험실 "사진·영수증", ADR-0012 — 2026-11-11).
 * 읽은 글만 저장하고 이 표는 볼 때마다 계산한다 (금액 저장 안 함 규칙). 글자 인식이 틀리면 글을 고치면 표도 바뀐다
 */
export interface ReceiptLine {
  name: string;
  price: number;
}

/** 줄 끝 금액: ¥1,200 · 1,200円 · 4,500원 · $12.50 · 1200 (앞 기호·뒤 단위는 있어도 되고 없어도 된다) */
const PRICE =
  /^(.*?)[\s:：]*[¥￥$₩€£]?\s?(\d{1,3}(?:[,，]\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(?:원|円|元|엔)?\s*$/;
/** 합계 줄 */
const TOTAL =
  /(합\s?계|총\s?액|총\s?금액|결제\s?금액|받을\s?금액|total|合\s?計|お会計|総\s?計|合计|总计)/i;
/** 품목이 아닌 줄 (소계·거스름돈·결제 수단·세금·날짜·전화번호 등) */
const SKIP =
  /(소\s?계|거스름|잔돈|받은\s?금액|현금|카드|부가세|과세|면세|봉사료|subtotal|change|cash|card|vat|tax|小\s?計|小计|お釣り?|釣銭|お預り?|預り|現金|消費税|内税|外税|税込|税抜|找零|现金|税|tel|電話|no\.|#)/i;
/** 날짜·시각처럼 보이는 줄 (2026-11-11, 12:30) */
const DATE_LIKE = /\d{2,4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}:\d{2}/;

export function parseReceipt(text: string): { lines: ReceiptLine[]; total: number | null } {
  const lines: ReceiptLine[] = [];
  let total: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || DATE_LIKE.test(line)) continue;
    const m = PRICE.exec(line);
    if (!m) continue;
    const name = m[1]!.replace(/[*·.…\-\s]+$/, '').trim();
    const price = Number(m[2]!.replace(/[,，]/g, '')) + (m[3] ? Number(`0.${m[3]}`) : 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (TOTAL.test(line)) {
      total = price;
      continue;
    }
    // 이름이 없거나 숫자만인 줄(수량·코드)은 품목이 아니다
    if (SKIP.test(line) || !/[\p{L}]/u.test(name)) continue;
    lines.push({ name, price });
  }
  return { lines, total };
}

type Timed = Pick<ItineraryItem, 'id' | 'startTime' | 'endTime' | 'kind'>;

/**
 * 찍은 사진을 붙일 일정 (사용자 결정 2026-11-11): 지금 진행 중 → 바로 앞(방금 끝난) → 다음 → 그날 첫 일정. 메모는 빼고
 */
export function photoTarget(items: readonly Timed[], now: string): string | null {
  const list = items.filter((i) => i.kind !== 'note');
  if (!list.length) return null;
  const cur = currentItemId(list, now);
  if (cur) return cur;
  const timed = list
    .filter((i) => i.startTime)
    .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
  const before = timed.filter((i) => i.startTime! <= now).pop();
  if (before) return before.id;
  return (timed[0] ?? list[0])!.id;
}
