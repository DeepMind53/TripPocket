/**
 * 메모 속 외화 → 원화 (2026-10-27): 메모에 적은 "¥1,200", "300바트", "NT$500"을 찾아
 * 저장해 둔 환율로 원화를 함께 보여 준다. 금액은 저장하지 않는다 (가계부 아님 — CLAUDE.md, 계산만)
 */
export interface MemoAmount {
  /** 메모 속 원문 (예: "¥1,200") */
  text: string;
  code: string;
  amount: number;
}

/** 1,200 / 1200 / 12.5 (끝의 쉼표·마침표는 빼고) */
const N = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;

/** 앞에 붙는 기호 → 통화 (¥·$는 여행 나라에 따라 따로) */
const PREFIX: [string, string][] = [
  [String.raw`NT\$`, 'TWD'],
  [String.raw`HK\$`, 'HKD'],
  [String.raw`S\$`, 'SGD'],
  [String.raw`A\$`, 'AUD'],
  [String.raw`C\$`, 'CAD'],
  [String.raw`US\$`, 'USD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['฿', 'THB'],
  ['₱', 'PHP'],
  ['₫', 'VND'],
  ['RM', 'MYR'],
  ['Rp', 'IDR'],
];

/** 뒤에 붙는 단위 (긴 것 먼저: "대만달러"가 "달러"보다 먼저) */
const SUFFIX: [string, string][] = [
  ['대만달러', 'TWD'],
  ['홍콩달러', 'HKD'],
  ['싱가포르달러', 'SGD'],
  ['호주달러', 'AUD'],
  ['캐나다달러', 'CAD'],
  ['엔', 'JPY'],
  ['위안', 'CNY'],
  ['바트', 'THB'],
  ['동', 'VND'],
  ['유로', 'EUR'],
  ['파운드', 'GBP'],
  ['페소', 'PHP'],
  ['링깃', 'MYR'],
  ['루피아', 'IDR'],
  ['달러', 'USD'],
];

/**
 * tripCurrency = 여행 나라 통화 — 기호가 겹칠 때(¥ = 엔/위안, $·달러 = 여러 달러) 그 나라 것으로 본다
 */
export function memoAmounts(text: string, tripCurrency?: string): MemoAmount[] {
  const dollar = tripCurrency && /D$/.test(tripCurrency) ? tripCurrency : 'USD';
  const yen = tripCurrency === 'CNY' ? 'CNY' : 'JPY';
  const found: (MemoAmount & { at: number })[] = [];
  const taken: [number, number][] = [];
  const scan = (pattern: string, code: string) => {
    for (const m of text.matchAll(new RegExp(pattern, 'g'))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      const amount = Number(m[1]!.replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      taken.push([start, end]);
      found.push({ text: m[0].trim(), code, amount, at: start });
    }
  };
  for (const [sym, code] of PREFIX) scan(`${sym}\\s?${N}`, code);
  scan(`¥\\s?${N}`, yen);
  scan(`(?<![A-Za-z])\\$\\s?${N}`, dollar);
  for (const [word, code] of SUFFIX)
    scan(`${N}\\s?${word}(?![가-힣])`, word === '달러' ? dollar : code);
  return found
    .sort((a, b) => a.at - b.at)
    .map(({ text: t, code, amount }) => ({ text: t, code, amount }));
}
