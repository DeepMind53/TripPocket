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
  // US$는 S$보다 먼저 ("US$" 안의 "S$"를 싱가포르 달러로 읽지 않게)
  [String.raw`US\$`, 'USD'],
  [String.raw`NT\$`, 'TWD'],
  [String.raw`HK\$`, 'HKD'],
  [String.raw`S\$`, 'SGD'],
  [String.raw`A\$`, 'AUD'],
  [String.raw`C\$`, 'CAD'],
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

/** $·"달러"를 쓰는 통화 (VND·KWD처럼 D로 끝나도 달러가 아닌 것이 있다) */
const DOLLARS = new Set(['USD', 'TWD', 'HKD', 'SGD', 'AUD', 'CAD', 'NZD']);

/**
 * tripCurrency = 여행 나라 통화 — 기호가 겹칠 때(¥ = 엔/위안, $·달러 = 여러 달러) 그 나라 것으로 본다
 */
export function memoAmounts(text: string, tripCurrency?: string): MemoAmount[] {
  const dollar = tripCurrency && DOLLARS.has(tripCurrency) ? tripCurrency : 'USD';
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
  // 원화 (2026-11-10): 해외 여행이면 여행 나라 돈으로 바꿔 보여 준다
  scan(`₩\\s?${N}`, 'KRW');
  for (const [word, code] of [...SUFFIX, ['원', 'KRW'] as [string, string]]) {
    // "동"은 아파트·건물 동(101동)과 겹친다 → 베트남 여행일 때만
    if (word === '동' && tripCurrency !== 'VND') continue;
    scan(`${N}\\s?${word}(?![가-힣])`, word === '달러' ? dollar : code);
  }
  return found
    .filter((f) => !(f.text.endsWith('동') && f.amount < 1000))
    .sort((a, b) => a.at - b.at)
    .map(({ text: t, code, amount }) => ({ text: t, code, amount }));
}

/** 금액 넣기 버튼이 메모에 적는 모양 — memoAmounts가 다시 읽을 수 있는 것만 (달러는 여행 나라와 겹치지 않게 US$) */
export function moneyText(code: string, amount: number): string | null {
  const n = amount.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  if (code === 'USD') return `US$${n}`;
  const word = SUFFIX.find(([, c]) => c === code)?.[0] ?? (code === 'KRW' ? '원' : undefined);
  return word ? `${n}${word}` : null;
}

/** 버튼 이름 ("엔", "위안") — 넣을 수 없는 통화면 null */
export function moneyLabel(code: string): string | null {
  if (code === 'KRW') return '원';
  if (code === 'USD') return '달러';
  return SUFFIX.find(([, c]) => c === code)?.[0] ?? null;
}

/**
 * 메모 금액 버튼 (사용자 요청 2026-11-10): 원·달러는 늘, 여행 나라 돈이 따로 있으면 뒤에 (일본 = 원·달러·엔, 중국 = 원·달러·위안)
 */
export function moneyCodes(tripCurrency: string | undefined): string[] {
  const local =
    tripCurrency && tripCurrency !== 'KRW' && tripCurrency !== 'USD' && moneyLabel(tripCurrency)
      ? [tripCurrency]
      : [];
  return ['KRW', 'USD', ...local];
}

/**
 * 괄호 안 환전 가격: 외화 → 원화, 원화 → 여행 나라 돈 (국내·달러 나라면 달러). rates = 1단위당 원.
 * 바꿀 환율이 없으면 null
 */
export function convertMoney(
  a: { code: string; amount: number },
  rates: Record<string, number>,
  tripCurrency: string | undefined,
): { code: string; amount: number } | null {
  if (a.code !== 'KRW') {
    const r = rates[a.code];
    return r ? { code: 'KRW', amount: Math.round(a.amount * r) } : null;
  }
  const to = tripCurrency && tripCurrency !== 'KRW' ? tripCurrency : 'USD';
  const r = rates[to];
  if (!r) return null;
  const v = a.amount / r;
  return { code: to, amount: v >= 100 ? Math.round(v) : Math.round(v * 100) / 100 };
}
