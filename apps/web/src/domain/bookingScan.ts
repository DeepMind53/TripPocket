import {
  addDays,
  AIRLINE_BAGGAGE,
  allAirports,
  findAirport,
  type LocalDate,
} from '@trippocket/shared';

/**
 * 예약 확인 화면 캡처 → 예약 칸 (실험실 bookingScan, 사용자 요청 2026-11-24, ADR-0012 추가).
 * 읽은 글은 기기 안에서만 나눈다 (AI에 보내지 않음). 못 찾은 칸은 비워 둔다.
 * KDE Itinerary 방식을 참고: 칸 이름("체크인", "출발", "예약번호") 옆 값을 먼저 보고, 없으면 나온 순서로.
 * 글자 인식은 같은 높이 글자를 한 줄로 묶어 주므로(server ocrRows) "체크인  체크아웃" 다음 줄에
 * "11월 3일  11월 6일"처럼 두 칸이 한 줄에 오는 모양도 다룬다
 */
export interface ScanSlot {
  date?: LocalDate;
  time?: string;
}

export interface BookingScan {
  flightNo?: string;
  /** 편명 앞 두 글자로 찾은 항공사 이름 */
  provider?: string;
  /** 공항 코드 (앱 공항 목록에 있는 것만, 나온 순서) */
  airports: string[];
  /** 나온 순서 (결제·발권·취소 같은 줄은 뺌) */
  dates: LocalDate[];
  times: string[];
  /** 칸 이름 옆에서 찾은 시작(출발·체크인·이용)과 끝(도착·체크아웃·반납) */
  start?: ScanSlot;
  end?: ScanSlot;
  confirmationNo?: string;
  phone?: string;
  /** 숙소·식당·투어 이름 */
  name?: string;
  address?: string;
  seat?: string;
  roomType?: string;
  partySize?: number;
}

export interface ScanOptions {
  /** 예약 종류 — 칸 이름("체크인"·"출발"·"이용일")을 고른다 */
  kind?: string;
  /** 연도 없는 날짜("11월 3일", "24 NOV")의 기준 (여행 시작일) */
  ref?: LocalDate;
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const pad = (n: number) => String(n).padStart(2, '0');

function monthOf(word: string): number {
  const w = word.toLowerCase().replace(/\.$/, '');
  return w.length < 3 ? -1 : MONTHS.findIndex((m) => m.startsWith(w));
}

function validDate(y: number, m: number, d: number): LocalDate | undefined {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 연도 없는 날짜: 기준일 해. 기준일보다 석 달 넘게 앞이면 다음 해 (12월에 1월 여행 예약) */
function guessYear(m: number, d: number, ref: LocalDate | undefined): LocalDate | undefined {
  if (!ref) return undefined;
  const y = Number(ref.slice(0, 4));
  const same = validDate(y, m, d);
  if (!same) return undefined;
  return same < addDays(ref, -90) ? validDate(y + 1, m, d) : same;
}

/** OCR 글자 정리: 전각 → 반각, 여러 가지 물결·쌍점 */
function normalizeText(text: string): string {
  return text
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/[〜～]/g, '~')
    .replace(/\r/g, '');
}

interface Hit<T> {
  at: number;
  end: number;
  value: T;
}

/** 겹치지 않게 모으기 — 앞에 넣은 모양이 먼저 */
function collect<T>(
  text: string,
  rules: { re: RegExp; read: (m: RegExpMatchArray) => T | undefined }[],
): Hit<T>[] {
  const hits: Hit<T>[] = [];
  for (const { re, read } of rules)
    for (const m of text.matchAll(re)) {
      const at = m.index;
      const end = at + m[0].length;
      if (hits.some((h) => at < h.end && end > h.at)) continue;
      const value = read(m);
      if (value !== undefined) hits.push({ at, end, value });
    }
  return hits.sort((a, b) => a.at - b.at);
}

const WEEKDAY = String.raw`(?:[월화수목금토일]|mon|tue|wed|thu|fri|sat|sun)`;

function dateHits(text: string, ref: LocalDate | undefined): Hit<LocalDate>[] {
  return collect<LocalDate>(text, [
    // 2026-11-03 · 2026.11.03 · 2026/11/03 · 2026년 11월 3일 · 2026年11月3日
    {
      re: /(20\d{2})\s*[-./년年]\s*(\d{1,2})\s*[-./월月]\s*(\d{1,2})(?!\d)\s*[일日]?/g,
      read: (m) => validDate(Number(m[1]), Number(m[2]), Number(m[3])),
    },
    // 11월 3일 · 11月3日 (연도 없음)
    {
      re: /(?<!\d)(\d{1,2})\s*[월月]\s*(\d{1,2})\s*[일日]/g,
      read: (m) => guessYear(Number(m[1]), Number(m[2]), ref),
    },
    // 24 Nov 2026 · 24 November · 03NOV26 · Tue 3 Nov
    {
      re: /(?<![\d:])(\d{1,2})\s*([A-Za-z]{3,9})\.?,?\s*'?(20\d{2}|\d{2}(?![:\d]))?(?![A-Za-z])/g,
      read: (m) => {
        const mon = monthOf(m[2]!);
        if (mon < 0) return undefined;
        const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
        return y ? validDate(y, mon + 1, Number(m[1])) : guessYear(mon + 1, Number(m[1]), ref);
      },
    },
    // Nov 24, 2026 · Tue, Nov 3 · November 3rd
    {
      re: /(?<![A-Za-z])([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?![\d:])(?:,?\s*(20\d{2}))?/g,
      read: (m) => {
        const mon = monthOf(m[1]!);
        if (mon < 0) return undefined;
        return m[3]
          ? validDate(Number(m[3]), mon + 1, Number(m[2]))
          : guessYear(mon + 1, Number(m[2]), ref);
      },
    },
    // 11/03/2026 (일·월 순서는 13 이상인 쪽으로 판단, 모르면 월/일)
    {
      re: /(?<!\d)(\d{1,2})\/(\d{1,2})\/(20\d{2})/g,
      read: (m) => {
        const a = Number(m[1]);
        const b = Number(m[2]);
        return a > 12 ? validDate(Number(m[3]), b, a) : validDate(Number(m[3]), a, b);
      },
    },
    // 11.03(화) · 11/3 (Tue) — 요일이 붙은 것만 (금액·시간과 헷갈리지 않게)
    {
      re: new RegExp(String.raw`(?<![\d.])(\d{1,2})[./](\d{1,2})\s*\(\s*${WEEKDAY}`, 'gi'),
      read: (m) => guessYear(Number(m[1]), Number(m[2]), ref),
    },
  ]);
}

function clock(h: number, min: number): string | undefined {
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? `${pad(h)}:${pad(min)}` : undefined;
}
const to24 = (h: number, pm: boolean) => (h === 12 ? (pm ? 12 : 0) : pm ? h + 12 : h);

function timeHits(text: string): Hit<string>[] {
  return collect<string>(text, [
    // 오후 3:00 · 오전 9시 30분 · 午後3時
    {
      re: /(오전|오후|午前|午後)\s*(\d{1,2})(?:\s*[:시時]\s*(\d{2})?\s*[분分]?)?/g,
      read: (m) => {
        const h = Number(m[2]);
        if (h > 12) return undefined;
        return clock(to24(h, m[1] === '오후' || m[1] === '午後'), Number(m[3] ?? 0));
      },
    },
    // 3:00 PM · 11 a.m.
    {
      re: /(?<![\d:])(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?(?![A-Za-z])/g,
      read: (m) => {
        const h = Number(m[1]);
        if (h > 12 || h === 0) return undefined;
        return clock(to24(h, m[3]!.toLowerCase() === 'p'), Number(m[2] ?? 0));
      },
    },
    // 15:00
    {
      // 글자 인식이 "09 : 00"처럼 띄어 읽기도 한다
      re: /(?<![\d:])([01]?\d|2[0-3]) ?: ?([0-5]\d)(?![\d:])/g,
      read: (m) => clock(Number(m[1]), Number(m[2])),
    },
    // 15시 · 15시 30분 · 15時 ("2시간"은 아님)
    {
      re: /(?<![\d:])(\d{1,2})\s*[시時](?!간|間)(?:\s*(\d{1,2})\s*[분分])?/g,
      read: (m) => clock(Number(m[1]), Number(m[2] ?? 0)),
    },
  ]);
}

/** 예약 날짜·시각이 아닌 줄 (결제·발권·취소 기한·소요 시간·탑승 시작 …) */
const SKIP_LINE =
  /결제|발권|구매|취소|환불|변경\s*가능|issued|payment|paid|cancel|refund|생년월일|birth|만료|유효\s*기간|소요|duration|비행\s*시간|flight\s*time|travel\s*time|탑승\s*(?:시작|수속|마감|시간)|boarding|게이트\s*마감|발행|printed|출력/i;
/** 항공·숙소: 예약한 날 (식당·투어는 "예약 일시"가 방문 시각이라 빼지 않는다) */
const BOOKED_LINE =
  /예약\s*(?:일|일시|날짜|완료|접수)|booking\s*date|booked\s*on|date\s*of\s*booking/i;

interface Label {
  key: 'start' | 'end';
  re: RegExp;
}

const LABELS: Record<string, Label[]> = {
  flight: [
    { key: 'start', re: /출발|departure|depart(?:s|ing)?(?![a-z])|出発/i },
    { key: 'end', re: /도착|arrival|arrive(?:s)?(?![a-z])|到着/i },
  ],
  lodging: [
    { key: 'start', re: /체크\s*인|입실|check[\s-]*in|チェックイン/i },
    { key: 'end', re: /체크\s*아웃|퇴실|check[\s-]*out|チェックアウト/i },
  ],
  car: [
    { key: 'start', re: /픽업|인수|대여\s*(?:일|일시)?|pick[\s-]*up|受取|貸出/i },
    { key: 'end', re: /반납|return|drop[\s-]*off|返却/i },
  ],
  other: [
    {
      key: 'start',
      re: /(?:예약|이용|방문|투어|체험|탑승|관람)\s*(?:일시|일자|날짜|일|시간)|일시|이용일|집합\s*시간|(?<![a-z])(?:date|time)(?![a-z])|日時/i,
    },
  ],
};

function labelsFor(kind: string | undefined): Label[] {
  return LABELS[kind === 'train' ? 'flight' : (kind ?? '')] ?? LABELS.other!;
}

/** 칸 이름 옆(같은 줄) 또는 아래 두 줄 안의 날짜·시각. 한 줄에 칸 이름이 둘이면 왼쪽 값 → 왼쪽 칸 */
function labeledSlots(
  lines: string[],
  labels: Label[],
  skip: (line: string) => boolean,
  ref: LocalDate | undefined,
): { start?: ScanSlot; end?: ScanSlot } {
  const out: Record<'start' | 'end', ScanSlot> = { start: {}, end: {} };
  const fill = (key: 'start' | 'end', date?: LocalDate, time?: string) => {
    if (date && !out[key].date) out[key].date = date;
    if (time && !out[key].time) out[key].time = time;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (skip(line)) continue;
    const found = labels
      .map((l) => {
        const m = l.re.exec(line);
        return m ? { key: l.key, at: m.index, end: m.index + m[0].length } : undefined;
      })
      .filter((x) => x !== undefined)
      .sort((a, b) => a.at - b.at);
    if (!found.length) continue;
    let inline = false;
    // "09:00 출발 11:20 도착"처럼 칸 이름이 값 뒤에 오는 줄 (마지막 칸 이름 뒤가 비고 첫 칸 이름 앞에 값)
    const head = line.slice(0, found[0]!.at);
    const suffix =
      !line.slice(found[found.length - 1]!.end).trim() &&
      (timeHits(head).length > 0 || dateHits(head, ref).length > 0);
    found.forEach((h, k) => {
      const seg = suffix
        ? line.slice(found[k - 1]?.end ?? 0, h.at)
        : line.slice(h.end, found[k + 1]?.at ?? line.length);
      const d = dateHits(seg, ref)[0]?.value;
      const t = (suffix ? timeHits(seg).at(-1) : timeHits(seg)[0])?.value;
      if (d && t) inline = true;
      fill(h.key, d, t);
    });
    if (inline) continue;
    for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
      const next = lines[j]!;
      if (skip(next) || labels.some((l) => l.re.test(next))) break;
      const ds = dateHits(next, ref).map((h) => h.value);
      const ts = timeHits(next).map((h) => h.value);
      // 칸이 하나면 그 줄 첫 값, 둘이면 왼쪽부터 차례로
      found.forEach((h, k) =>
        fill(h.key, ds[found.length === 1 ? 0 : k], ts[found.length === 1 ? 0 : k]),
      );
    }
  }
  const slot = (s: ScanSlot) => (s.date || s.time ? s : undefined);
  const start = slot(out.start);
  const end = slot(out.end);
  return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

/** 칸 이름 뒤 값 (같은 줄, 없으면 다음 줄) */
function valueAfter(
  lines: string[],
  label: RegExp,
  value: RegExp,
  pick: (m: RegExpExecArray) => string | undefined = (m) => m[1],
): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = label.exec(lines[i]!);
    if (!m) continue;
    // "예약번호(PNR): …", "Booking No. …"처럼 칸 이름 뒤 괄호·쌍점은 건너뛴다
    const rest = lines[i]!.slice(m.index + m[0].length).replace(
      /^\s*(?:\([^)]{0,12}\))?\s*[:：#.)\]]?\s*/,
      '',
    );
    const v = value.exec(rest);
    if (v && v.index <= 2) return pick(v);
    if (!rest.trim() && lines[i + 1]) {
      const n = value.exec(lines[i + 1]!.trim());
      if (n && n.index === 0) return pick(n);
    }
  }
  return undefined;
}

const NO_LABEL_FLIGHT =
  /항공사\s*예약\s*번호|PNR|record\s*locator|booking\s*reference|booking\s*ref\.?|예약\s*번호\s*\(PNR\)/i;
const NO_LABEL =
  /예약\s*(?:번호|코드|ID|확인\s*번호)|확인\s*(?:번호|코드)|승차권\s*번호|확정\s*번호|바우처\s*번호|주문\s*번호|booking\s*(?:reference|ref\.?|number|no\.?|code|id)|confirmation\s*(?:number|no\.?|code|#)|reservation\s*(?:number|no\.?|code|id)|itinerary\s*(?:number|no\.?)|order\s*(?:number|no\.?)|PNR|予約番号|確認番号/i;
/** 숫자 묶음은 띄어 써도 하나로 ("4821 553 190", "4821.553.190") / 영문·숫자 섞인 코드 */
const NO_VALUE = /(\d{3,}(?:[ .-]\d{2,})*(?![A-Za-z0-9])|[A-Z0-9][A-Z0-9-]{4,19}(?![A-Za-z0-9]))/;

function confirmationOf(lines: string[], kind: string | undefined): string | undefined {
  // 항공권 번호(13자리 e-티켓)는 예약번호가 아님
  const ok = lines.map((l) =>
    l.replace(/(?:항공권|e-?티켓|티켓|ticket)\s*(?:번호|number|no\.?)\s*[:：]?\s*[\d -]+/gi, ''),
  );
  const raw =
    (kind === 'flight' ? valueAfter(ok, NO_LABEL_FLIGHT, NO_VALUE) : undefined) ??
    valueAfter(ok, NO_LABEL, NO_VALUE);
  if (!raw) return undefined;
  const v = /^[\d .-]+$/.test(raw) ? raw.replace(/[ .]/g, '') : raw;
  return v.toUpperCase().slice(0, 60);
}

const AIRLINE_CODES = new Map(AIRLINE_BAGGAGE.map((a) => [a.code.toUpperCase(), a.name]));

function flightOf(text: string): { flightNo: string; provider?: string } | undefined {
  const re = /(?<![A-Za-z0-9])(?!T\d)([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})(?![\d:A-Za-z])/g;
  const keyword = /편명|항공편|flight|便名/gi;
  const keys = [...text.matchAll(keyword)].map((m) => m.index + m[0].length);
  for (const m of text.matchAll(re)) {
    const code = m[1]!;
    const num = m[2]!.replace(/^0+(?=\d)/, '');
    const known = AIRLINE_CODES.has(code);
    const nearKey = keys.some((k) => m.index >= k && m.index - k <= 20);
    if (!known && !nearKey) continue;
    if (!known && num.length < 2) continue;
    const provider = AIRLINE_CODES.get(code);
    return { flightNo: `${code}${num}`, ...(provider ? { provider } : {}) };
  }
  return undefined;
}

/** 공항 이름 → 코드 ("인천국제공항", "나리타", "Incheon"). 도시 이름은 공항이 여럿일 수 있어 쓰지 않는다 */
const AIRPORT_NAMES: { re: RegExp; iata: string }[] = (() => {
  const out: { re: RegExp; iata: string }[] = [];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const a of allAirports()) {
    const short = a.name.replace(/(?:국제)?공항$/, '');
    const names = new Set([a.name, ...(short.length >= 2 ? [short] : [])]);
    for (const n of names) out.push({ re: new RegExp(esc(n), 'g'), iata: a.iata });
    const en = a.nameEn
      .replace(/\(.*\)/, '')
      .replace(/\s*International\s*/, ' ')
      .trim();
    if (en.length >= 4) out.push({ re: new RegExp(String.raw`\b${esc(en)}\b`, 'g'), iata: a.iata });
  }
  // 긴 이름 먼저 ("신치토세" > "치토세")
  return out.sort((x, y) => y.re.source.length - x.re.source.length);
})();

/** 항공사 이름은 공항이 아님 ("제주항공" ≠ 제주공항, "Jeju Air") — 공항을 찾기 전에 지운다 */
const AIRLINE_NAMES: RegExp[] = AIRLINE_BAGGAGE.flatMap((a) => [a.name, ...a.aliases])
  .map((n) => n.replace(/\s/g, ''))
  .filter((n) => n.length >= 3)
  .map(
    (n) =>
      new RegExp(
        [...n].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(String.raw`\s*`),
        'gi',
      ),
  );

function airportsOf(raw: string): string[] {
  let text = raw;
  for (const re of AIRLINE_NAMES) text = text.replace(re, (m) => ' '.repeat(m.length));
  const hits: { at: number; end: number; iata: string }[] = [];
  const add = (at: number, end: number, iata: string) => {
    if (!hits.some((h) => at < h.end && end > h.at)) hits.push({ at, end, iata });
  };
  // 대문자 세 글자 (원래 대문자인 것만 — 영어 낱말 "can"은 광저우가 아님)
  for (const m of text.matchAll(/(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g))
    if (findAirport(m[1]!)?.iata === m[1]) add(m.index, m.index + 3, m[1]!);
  for (const { re, iata } of AIRPORT_NAMES)
    for (const m of text.matchAll(re)) add(m.index, m.index + m[0].length, iata);
  const out: string[] = [];
  for (const h of hits.sort((a, b) => a.at - b.at)) if (!out.includes(h.iata)) out.push(h.iata);
  return out;
}

const LODGING_WORD =
  /호텔|hotel|inn(?![a-z])|(?<![a-z])stay(?![a-z])|아파트|apartment|빌라|villa|resort|리조트|게스트\s*하우스|guest\s*house|hostel|호스텔|료칸|ryokan|모텔|펜션|스테이|suites?(?![a-z])|residence|레지던스|콘도|ホテル|旅館/i;
const NOT_NAME =
  /예약|확인|confirm|booking|감사|체크|check[\s-]*(?:in|out)|요$|니다|[?!]$|주소|address|전화|(?<![a-z])tel(?![a-z])|phone/i;

function nameOf(lines: string[], kind: string | undefined): string | undefined {
  const label =
    kind === 'lodging'
      ? /(?:숙소\s*(?:명|이름)?|호텔\s*(?:명|이름)?|숙박\s*시설|hotel\s*name|property(?:\s*name)?|hotel|accommodation|施設名|ホテル名)(?=\s*[:：]|\s*$)/i
      : /(?:상품\s*명|투어\s*명|식당\s*(?:명|이름)?|레스토랑|매장\s*명|업체\s*명|상호|restaurant|product|activity|tour\s*name|店名|商品名)(?=\s*[:：]|\s*$)/i;
  const v = valueAfter(lines, label, /([^\n:：].{1,79})/)?.trim();
  if (v) return v;
  if (kind !== 'lodging') return undefined;
  return lines
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && l.length <= 60 && LODGING_WORD.test(l) && !NOT_NAME.test(l));
}

export function scanBooking(raw: string, opts: ScanOptions = {}): BookingScan {
  const text = normalizeText(raw);
  const { kind, ref } = opts;
  const lines = text.split('\n');
  const bookedToo = kind === 'flight' || kind === 'lodging';
  const skip = (l: string) => SKIP_LINE.test(l) || (bookedToo && BOOKED_LINE.test(l));
  const kept = lines.filter((l) => !skip(l));

  const dates: LocalDate[] = [];
  const times: string[] = [];
  for (const l of kept) {
    for (const h of dateHits(l, ref)) if (!dates.includes(h.value)) dates.push(h.value);
    for (const h of timeHits(l)) if (!times.includes(h.value)) times.push(h.value);
  }
  const slots = labeledSlots(lines, labelsFor(kind), skip, ref);
  const flight = flightOf(text);
  const phone = valueAfter(
    lines,
    /전화\s*(?:번호)?|연락처|대표\s*번호|(?<![A-Za-z])(?:tel(?:ephone)?\.?|phone)|☎|電話/i,
    /(\+?\(?\d[\d\s().-]{6,20}\d)/,
  )?.trim();
  const address = valueAfter(
    lines,
    /(?<!메일\s{0,2}|mail\s{0,2})(?:주소|address)|所在地|住所/i,
    /([^\n:：].{4,119})/,
  )?.trim();
  const seat = /(?:좌석|seat)\s*(?:번호|no\.?)?\s*[:：]?\s*(\d{1,2}[A-K])(?![A-Za-z0-9])/i.exec(
    text,
  )?.[1];
  const roomType =
    kind === 'lodging'
      ? valueAfter(
          lines,
          /(?:객실\s*(?:타입|유형|종류|정보)|room\s*type)(?=\s*[:：]|\s*$)|(?:객실|room)(?=\s*[:：])/i,
          /([^\n:：].{1,59})/,
        )?.trim()
      : undefined;
  const party =
    /(?:인원|투숙객|게스트|guests?|adults?|성인)\s*[:：]?\s*(\d{1,2})(?!\d)|(?<!\d)(\d{1,2})\s*(?:명|인(?![가-힣])|adults?|guests?|people|persons?)/i.exec(
      text,
    );
  const partySize = party ? Number(party[1] ?? party[2]) : undefined;
  const name = kind === 'flight' || kind === 'car' ? undefined : nameOf(lines, kind);
  const confirmationNo = confirmationOf(lines, kind);
  return {
    ...(flight ?? {}),
    airports:
      kind === undefined || kind === 'flight' || kind === 'transfer' ? airportsOf(text) : [],
    dates,
    times,
    ...slots,
    ...(confirmationNo ? { confirmationNo } : {}),
    ...(phone ? { phone } : {}),
    ...(name ? { name: name.slice(0, 100) } : {}),
    ...(address ? { address: address.slice(0, 120) } : {}),
    ...(seat ? { seat: seat.toUpperCase() } : {}),
    ...(roomType ? { roomType: roomType.slice(0, 60) } : {}),
    ...(partySize && partySize > 0 && partySize <= 50 ? { partySize } : {}),
  };
}

/** 예약 종류별 단서 — 한 번 나올 때마다 점수 (항공권 안의 "호텔 추천"처럼 섞여도 많이 나온 쪽) */
const KIND_HINTS: { kind: string; re: RegExp; w: number }[] = [
  {
    kind: 'flight',
    re: /항공권|항공편|탑승권|편명|boarding\s*pass|e-?ticket|e-?티켓|flight|PNR|여정|좌석\s*등급|수하물|baggage|便名|搭乗/gi,
    w: 2,
  },
  {
    kind: 'lodging',
    re: /체크\s*인|체크\s*아웃|check[\s-]*(?:in|out)|입실|퇴실|투숙|숙박|객실|room\s*type|숙소|호텔|hotel|게스트\s*하우스|료칸|チェックイン|宿泊/gi,
    w: 2,
  },
  {
    kind: 'train',
    re: /KTX|SRT|ITX|코레일|korail|승차권|열차|호차|신칸센|新幹線|JR\s|train|기차|乗車券|号車/gi,
    w: 3,
  },
  {
    kind: 'car',
    re: /렌터카|렌트카|rent[\s-]*a[\s-]*car|rental\s*car|rentalcars|차량\s*(?:인수|반납)|차종|대여|반납|drop[\s-]*off|レンタカー/gi,
    w: 3,
  },
  {
    kind: 'restaurant',
    re: /식당|레스토랑|restaurant|캐치테이블|테이블링|tablecheck|opentable|다이닝|dining|코스\s*요리|오마카세|런치|디너|ディナー|ランチ/gi,
    w: 3,
  },
  {
    kind: 'transfer',
    re: /공항\s*픽업|공항\s*샌딩|샌딩|transfer|픽업\s*샌딩|送迎/gi,
    w: 3,
  },
  { kind: 'tour', re: /투어|tour|체험|activity|가이드|guide|원데이\s*클래스|ツアー/gi, w: 2 },
  {
    kind: 'ticket',
    re: /입장권|이용권|admission|입장|패스|pass(?!port|enger)|티켓(?!\s*번호)|チケット|入場券/gi,
    w: 2,
  },
];

/**
 * 캡처 글이 어떤 예약인지 (사용자 요청 2026-11-24 "사진이 항공권이면 항공 탭으로").
 * 편명·공항 둘이 보이면 항공 쪽으로 더한다. 단서가 없으면 undefined (지금 고른 종류 그대로)
 */
export function guessBookingKind(raw: string): string | undefined {
  const text = normalizeText(raw);
  const score = new Map<string, number>();
  const add = (k: string, n: number) => score.set(k, (score.get(k) ?? 0) + n);
  for (const { kind, re, w } of KIND_HINTS) add(kind, (text.match(re)?.length ?? 0) * w);
  if (flightOf(text)) add('flight', 3);
  if (airportsOf(text).length >= 2) add('flight', 3);
  // 체크인·체크아웃이 둘 다 있으면 숙소 (항공권의 "온라인 체크인"과 구분)
  if (/체크\s*아웃|check[\s-]*out|퇴실|チェックアウト/i.test(text)) add('lodging', 4);
  // 픽업 + 반납 = 렌터카, 공항 + 픽업(반납 없음) = 픽업·드랍
  if (/픽업|pick[\s-]*up/i.test(text) && /반납|return/i.test(text)) add('car', 3);
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : undefined;
}

/**
 * IATA 탑승권 바코드(BCBP, PDF417·Aztec·QR) — 기기 안에서 읽은 글 → 예약 칸.
 * "M1HONG/GILDONG        EAB12CDE ICNNRTKE 0703 307Y012A0045 100" (연도는 없어서 기준일에 가까운 해로)
 */
export function parseBoardingPass(raw: string, ref: LocalDate): BookingScan | undefined {
  const s = raw.replace(/\r?\n/g, '');
  if (!/^M[1-4]/.test(s) || s.length < 58) return undefined;
  const pnr = s.slice(23, 30).trim();
  const from = s.slice(30, 33);
  const to = s.slice(33, 36);
  const carrier = s.slice(36, 39).trim();
  const num = s
    .slice(39, 44)
    .trim()
    .replace(/^0+(?=\d)/, '');
  const julian = Number(s.slice(44, 47));
  const seat = s
    .slice(48, 52)
    .trim()
    .replace(/^0+(?=\d)/, '');
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !/^[A-Z0-9]{2,3}$/.test(carrier))
    return undefined;
  if (!/^\d{1,4}[A-Z]?$/.test(num) || !(julian >= 1 && julian <= 366)) return undefined;
  // 기준일 해·앞뒤 해 중 기준일에 가장 가까운 날
  const y = Number(ref.slice(0, 4));
  const day = (yy: number) => addDays(`${yy}-01-01` as LocalDate, julian - 1);
  const refT = Date.parse(ref);
  const date = [y - 1, y, y + 1]
    .map(day)
    .sort((a, b) => Math.abs(Date.parse(a) - refT) - Math.abs(Date.parse(b) - refT))[0]!;
  const provider = AIRLINE_CODES.get(carrier);
  return {
    flightNo: `${carrier}${num}`,
    ...(provider ? { provider } : {}),
    airports: [from, to],
    dates: [date],
    times: [],
    start: { date },
    ...(pnr ? { confirmationNo: pnr } : {}),
    ...(/^\d{1,2}[A-K]$/.test(seat) ? { seat } : {}),
  };
}

/** 캡처로 채울 수 있는 예약 칸 (BookingForm 상태의 일부) */
export interface ScanTarget {
  flightNo: string;
  provider: string;
  from: string;
  to: string;
  title: string;
  phone: string;
  address: string;
  seat: string;
  roomType: string;
  partySize: string;
  confirmationNo: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

/**
 * 나눈 글 → 예약 칸. 글자 칸은 비어 있을 때만, 날짜·시각은 새 예약(초기값)이거나 비어 있을 때만 바꾼다.
 * 칸 이름 옆에서 찾은 값이 먼저, 없으면 나온 순서. 몇 칸을 채웠는지 함께 돌려준다
 */
export function applyScan(
  kind: string,
  scan: BookingScan,
  cur: ScanTarget,
  isNew: boolean,
): { patch: Partial<ScanTarget>; filled: number } {
  const patch: Partial<ScanTarget> = {};
  const text = (k: keyof ScanTarget, v: string | undefined) => {
    if (v && !cur[k].trim()) patch[k] = v;
  };
  const when = (k: keyof ScanTarget, v: string | undefined) => {
    if (v && (isNew || !cur[k]) && cur[k] !== v) patch[k] = v;
  };
  text('confirmationNo', scan.confirmationNo);
  const [d1, d2] = scan.dates;
  const [t1, t2] = scan.times;
  const labeled = !!(scan.start || scan.end);
  const sDate = scan.start?.date ?? d1;
  const sTime = labeled ? scan.start?.time : t1;
  const eTime = labeled ? scan.end?.time : t2;
  if (kind === 'flight') {
    text('flightNo', scan.flightNo);
    text('provider', scan.provider);
    text('from', scan.airports[0]);
    text('to', scan.airports[1]);
    text('seat', scan.seat);
    when('startDate', sDate);
    // 도착 날짜: 칸 이름 옆 값, 없으면 출발 날 (도착 시각이 더 이르면 다음 날). 왕복 캡처의 오는 날은 쓰지 않는다
    const st = sTime ?? t1;
    const et = eTime ?? (t1 === st ? t2 : undefined);
    const eDate =
      scan.end?.date ?? (sDate && st && et && et < st ? addDays(sDate as LocalDate, 1) : sDate);
    when('endDate', eDate);
    when('startTime', st);
    when('endTime', et);
  } else if (kind === 'lodging') {
    text('title', scan.name);
    text('phone', scan.phone?.slice(0, 40));
    text('address', scan.address);
    text('roomType', scan.roomType);
    when('startDate', sDate);
    when('endDate', scan.end?.date ?? (labeled ? undefined : d2));
    when('startTime', sTime);
    when('endTime', eTime);
  } else {
    if (kind !== 'car' && kind !== 'train') text('title', scan.name);
    if (kind !== 'car' && kind !== 'flight') text('partySize', scan.partySize?.toString());
    text('phone', scan.phone?.slice(0, 40));
    if (kind === 'restaurant') text('address', scan.address);
    when('startDate', sDate);
    when('startTime', sTime ?? (labeled ? t1 : undefined));
    if (kind === 'car') {
      when('endDate', scan.end?.date ?? (labeled ? undefined : d2));
      when('endTime', eTime);
    }
  }
  return { patch, filled: Object.keys(patch).length };
}
