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

/**
 * 줄 끝 금액 (2026-11-12 보강 — 실제 영수증에서 잘 안 읽히던 모양):
 * ¥1,200 · 1,200円 · 4,500원 · $12.50 · 12,50 € · 1.234,50 · 할인 -500 · △100(일본 할인) ·
 * 뒤에 붙는 표시 ¥150軽(경감세율) · 1,200- · 4.99 T(미국 과세 표시) · 500 *
 */
const PRICE =
  /^(.*?)[\s:]*([-−△▲])?\s?[¥$₩€£]?\s?([-−])?(\d{1,3}(?:,\d{3})+|\d{1,3}(?:\.\d{3})+(?=,\d{2})|\d+)(?:[.,](\d{1,2}))?\s?(?:원|円|元|엔|€|EUR|USD)?(?:\s*(?:軽|※|\*|内|外|非|[A-Z]|-))*\s*$/u;
/** 합계 줄 */
const TOTAL =
  /(합\s?계|총\s?액|총\s?금액|결제\s?금액|받을\s?금액|total|合\s?計|お会計|総\s?計|合计|总计)/i;
/** 품목이 아닌 줄 (소계·거스름돈·결제 수단·세금·날짜·전화번호 등) */
const SKIP =
  /(소\s?계|거스름|잔돈|받은\s?금액|현금|카드|부가세|과세|면세|봉사료|subtotal|change|cash|card|vat|tax|小\s?計|小计|お釣り?|釣銭|お預り?|預り|現金|消費税|内税|外税|税込|税抜|找零|现金|税|tel|電話|no\.|#)/i;
/** 날짜·시각처럼 보이는 줄 (2026-11-11, 12:30) */
const DATE_LIKE = /\d{2,4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}:\d{2}/;
/** 이름 뒤에 붙은 단가·수량 칸 ("아메리카노 4,500 2", "ビール x2", "coffee 2EA") */
const TRAIL_QTY = /\s+(?:[x×@]?\s?\d[\d,.]*\s?(?:개|点|個|EA|ea|pcs)?|[x×]\s?\d+)$/u;
/** 이름 앞 품목 번호·바코드 ("001 아메리카노", "8801234567890 우유") */
const LEAD_CODE = /^(?:\d{1,4}[.)]?|\d{6,})\s+/;

type Label = { kind: 'item' | 'total' | 'skip'; name: string };

function priceOf(m: RegExpExecArray): number {
  const sign = m[2] || m[3] ? -1 : 1;
  const whole = Number(m[4]!.replace(/[,.]/g, ''));
  const frac = m[5] ? Number(`0.${m[5]}`) : 0;
  return sign * (whole + frac);
}

function cleanName(raw: string): string {
  let name = raw.replace(/[*·.…\-\s:]+$/, '').trim();
  for (let i = 0; i < 3 && TRAIL_QTY.test(name); i++) name = name.replace(TRAIL_QTY, '').trim();
  return name.replace(LEAD_CODE, '').trim();
}

const hasLetter = (s: string) => /\p{L}/u.test(s);

export function parseReceipt(text: string): { lines: ReceiptLine[]; total: number | null } {
  const lines: ReceiptLine[] = [];
  let total: number | null = null;
  // 금액이 없는 이름 줄과, 이름이 없는 금액 줄 — 열마다 따로 읽힌 글자 인식 결과를 짝지을 때
  let names: Label[] = [];
  let prices: number[] = [];
  const put = (label: Label, price: number) => {
    if (label.kind === 'total') total = Math.abs(price);
    else if (label.kind === 'item' && price !== 0) lines.push({ name: label.name, price });
  };
  // 금액 줄이 몰려 나오면, 바로 앞 이름 줄들과 순서대로 짝짓는다 (가게 이름 같은 위쪽 줄은 남는다)
  const flush = () => {
    if (prices.length && names.length) {
      const k = Math.min(prices.length, names.length);
      const tail = names.slice(-k);
      tail.forEach((l, i) => put(l, prices[i]!));
    }
    names = [];
    prices = [];
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.normalize('NFKC').trim();
    if (!line || DATE_LIKE.test(line)) continue;
    const m = PRICE.exec(line);
    const name = m ? cleanName(m[1]!) : '';
    if (m && !hasLetter(name)) {
      // 이름 없는 금액만 — 앞에 이름 줄이 있으면 짝, 없으면(수량·코드) 버린다
      if (names.length) prices.push(priceOf(m));
      continue;
    }
    if (prices.length) flush();
    const kind: Label['kind'] = TOTAL.test(line) ? 'total' : SKIP.test(line) ? 'skip' : 'item';
    if (!m) {
      if (hasLetter(line)) names.push({ kind, name: cleanName(line) });
      continue;
    }
    // 이름과 금액이 한 줄 — 그 위 이름만 있던 줄은 가게 이름·주소 같은 머리 줄
    names = [];
    const price = priceOf(m);
    if (!Number.isFinite(price)) continue;
    put({ kind, name }, price);
  }
  flush();
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
