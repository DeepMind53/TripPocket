import { parseEximRow, type FxSnapshot } from '@trippocket/shared';
import type { Db } from '../db/database';

/**
 * 한국수출입은행 현재환율 API (docs/12 §2, 무료·인증키는 서버 .env에만).
 * 영업일 11시경 1회 고시 — 주말·공휴일·고시 전에는 빈 응답 → 직전 값 유지
 */
const EXIM_URL = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';

/** 서울 날짜 YYYY-MM-DD, 시·요일 */
function seoulNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    weekend: ['Sat', 'Sun'].includes(get('weekday')),
  };
}

/** 오늘 고시를 받아 저장. 저장한 통화 수 (빈 응답이면 0) */
export async function fetchExim(db: Db, key: string, now = new Date()): Promise<number> {
  const { date } = seoulNow(now);
  const url = `${EXIM_URL}?authkey=${encodeURIComponent(key)}&searchdate=${date.replace(/-/g, '')}&data=AP01`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`exim ${res.status}`);
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) return 0;
  const fetchedAt = new Date().toISOString();
  let n = 0;
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      const row = r as { result?: number; cur_unit?: string; deal_bas_r?: string };
      if (row.result !== 1 || !row.cur_unit || !row.deal_bas_r) continue;
      const parsed = parseEximRow(row.cur_unit, row.deal_bas_r);
      if (!parsed) continue;
      db.prepare(
        `INSERT INTO fx_rates (date, currency, rate, fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (date, currency) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at`,
      ).run(date, parsed[0], parsed[1], fetchedAt);
      n++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return n;
}

/** 가장 최근 고시일의 환율 */
export function latestFx(db: Db): FxSnapshot | null {
  const last = db
    .prepare(
      'SELECT date, MAX(fetched_at) AS fetched_at FROM fx_rates GROUP BY date ORDER BY date DESC LIMIT 1',
    )
    .get() as { date: string; fetched_at: string } | undefined;
  if (!last) return null;
  const rows = db.prepare('SELECT currency, rate FROM fx_rates WHERE date = ?').all(last.date) as {
    currency: string;
    rate: number;
  }[];
  return {
    source: 'koreaexim',
    date: last.date,
    fetchedAt: last.fetched_at,
    rates: Object.fromEntries(rows.map((r) => [r.currency, r.rate])),
  };
}

/**
 * 매시 확인: 평일 11시 이후이고 오늘 값이 아직 없으면 받기 (11:15·14:00 재시도 대신 매시 — 같은 효과, 단순)
 */
export function scheduleFx(db: Db, key: string, log: (msg: string) => void): () => void {
  const tick = async () => {
    const { date, hour, weekend } = seoulNow();
    if (weekend || hour < 11) return;
    if (latestFx(db)?.date === date) return;
    try {
      const n = await fetchExim(db, key);
      log(n ? `환율 ${n}개 저장 (${date})` : `환율 고시 없음 (${date})`);
    } catch (e) {
      log(`환율 받기 실패: ${String(e)}`);
    }
  };
  void tick();
  const id = setInterval(() => void tick(), 3_600_000);
  return () => clearInterval(id);
}
