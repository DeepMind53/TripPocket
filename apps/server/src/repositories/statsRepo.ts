import { PLAN_FEATURES } from '@trippocket/shared';
import type { Db } from '../db/database';

/**
 * 사용 통계 (관리자만, ADR-0009): 날짜·종류·이름별 횟수만 저장한다.
 * 사용자 id·입력 내용·장소·위치는 넣지 않는다 — 누가 했는지 알 수 없는 합계만.
 * kind: active(하루 사용자) · api(요청) · api_4xx · api_5xx · api_ms(응답 시간 구간) · limit(한도 도달)
 *       · data(동기화 입력·수정·삭제) · sync(충돌) · ai(추천 결과) · event(앱에서 센 기능) · env(기기 환경)
 */
export const STATS_KEEP_DAYS = 3 * 365 + 1;
/** 응답 시간 구간 (ms) — 보통·느린 경우(p50·p95)를 대략 계산한다 */
export const MS_BUCKETS = [100, 300, 1000, 3000, 10000] as const;

/** 한국 날짜 (YYYY-MM-DD) */
export const statDate = (now = new Date()) =>
  new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
const daysAgo = (n: number, now = new Date()) => statDate(new Date(now.getTime() - n * 86_400_000));

const bucketOf = (ms: number) => MS_BUCKETS.find((b) => ms < b) ?? Infinity;

interface Row {
  name: string;
  n: number;
}

export function statsRepo(db: Db) {
  const upsert = db.prepare(
    `INSERT INTO usage_stats (date, kind, name, count) VALUES (?, ?, ?, ?)
     ON CONFLICT (date, kind, name) DO UPDATE SET count = count + excluded.count`,
  );
  let prunedOn = '';

  function bump(kind: string, name: string, n = 1, date = statDate()): void {
    if (n <= 0) return;
    upsert.run(date, kind, name.slice(0, 80), n);
    // 하루 한 번 3년 지난 통계를 지운다
    if (prunedOn !== date) {
      prunedOn = date;
      db.prepare('DELETE FROM usage_stats WHERE date < ?').run(daysAgo(STATS_KEEP_DAYS));
    }
  }

  /** 오늘 처음 쓴 사람이면 하루 사용자 수 +1 (누구인지는 통계에 남지 않음) */
  function markActive(userId: string): void {
    const today = statDate();
    const changed = db
      .prepare(
        'UPDATE users SET last_active_date = ?, active_days = active_days + 1 WHERE id = ? AND (last_active_date IS NULL OR last_active_date != ?)',
      )
      .run(today, userId, today);
    if (Number(changed.changes) > 0) bump('active', 'users', 1, today);
  }

  /** 서버 요청 한 번: 경로 패턴(값 없음)·결과·걸린 시간. 로그인한 요청은 한국 시각 시간대도 */
  function request(route: string, status: number, ms: number, signedIn = false): void {
    bump('api', route);
    if (signedIn)
      bump('hour', String(new Date(Date.now() + 9 * 3_600_000).getUTCHours()).padStart(2, '0'));
    if (status >= 500) bump('api_5xx', route);
    else if (status >= 400) bump('api_4xx', route);
    if (status === 429) bump('limit', route);
    bump('api_ms', `${route}|${bucketOf(ms)}`);
  }

  const sum = (kind: string, since: string): Row[] =>
    db
      .prepare(
        'SELECT name, SUM(count) AS n FROM usage_stats WHERE kind = ? AND date >= ? GROUP BY name ORDER BY n DESC',
      )
      .all(kind, since) as unknown as Row[];

  /** 관리자 화면: 최근 days일 */
  function summary(days: number) {
    const since = daysAgo(days - 1);
    const today = statDate();
    const one = (sql: string, ...args: (string | number)[]) =>
      (db.prepare(sql).get(...args) as { n: number | null }).n ?? 0;

    // 사용자
    const hours = new Map(sum('hour', since).map((r) => [r.name, r.n]));
    const activeSince = (d: number) =>
      one('SELECT COUNT(*) AS n FROM users WHERE last_active_date >= ?', daysAgo(d - 1));
    const daily = db
      .prepare(
        "SELECT date, count AS n FROM usage_stats WHERE kind = 'active' AND date >= ? ORDER BY date",
      )
      .all(since) as unknown as { date: string; n: number }[];
    const signups = db
      .prepare(
        // created_at은 UTC — 한국 날짜로 묶는다
        "SELECT date(created_at, '+9 hours') AS date, COUNT(*) AS n FROM users WHERE date(created_at, '+9 hours') >= ? GROUP BY 1 ORDER BY 1",
      )
      .all(since) as unknown as { date: string; n: number }[];
    // 재방문: 가입 N일이 지난 사람 중 N일 뒤에도 다시 쓴 사람 (마지막 사용 날짜로 판단)
    const retention = (d: number) => ({
      base: one(
        "SELECT COUNT(*) AS n FROM users WHERE date(created_at, '+9 hours') <= ?",
        daysAgo(d),
      ),
      back: one(
        "SELECT COUNT(*) AS n FROM users WHERE date(created_at, '+9 hours') <= ? AND last_active_date >= date(created_at, '+9 hours', ?)",
        daysAgo(d),
        `+${d} days`,
      ),
    });
    const activeDays = db
      .prepare(
        `SELECT CASE WHEN active_days <= 1 THEN '1' WHEN active_days <= 3 THEN '2-3'
           WHEN active_days <= 7 THEN '4-7' WHEN active_days <= 30 THEN '8-30' ELSE '31+' END AS name,
           COUNT(*) AS n FROM users GROUP BY 1`,
      )
      .all() as unknown as Row[];
    const order = ['1', '2-3', '4-7', '8-30', '31+'];
    const users = {
      total: one('SELECT COUNT(*) AS n FROM users'),
      retention7: retention(7),
      retention30: retention(30),
      activeDays: order.map((name) => ({
        name,
        n: activeDays.find((r) => r.name === name)?.n ?? 0,
      })),
      hours: Array.from({ length: 24 }, (_, h) => {
        const name = String(h).padStart(2, '0');
        return { name, n: hours.get(name) ?? 0 };
      }),
      active1: activeSince(1),
      active7: activeSince(7),
      active30: activeSince(30),
      daily,
      signups,
      providers: db
        .prepare(
          'SELECT provider AS name, COUNT(*) AS n FROM oauth_accounts GROUP BY provider ORDER BY n DESC',
        )
        .all() as unknown as Row[],
    };

    // 요청: 경로별 횟수·실패·응답 시간(구간에서 대략 계산)
    const ms = new Map<string, Map<number, number>>();
    for (const r of sum('api_ms', since)) {
      const [route, b] = r.name.split('|');
      const m = ms.get(route!) ?? new Map<number, number>();
      m.set(Number(b), r.n);
      ms.set(route!, m);
    }
    const pct = (route: string, p: number) => {
      const m = ms.get(route);
      if (!m) return null;
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      let acc = 0;
      for (const b of [...MS_BUCKETS, Infinity]) {
        acc += m.get(b) ?? 0;
        if (acc >= total * p) return b === Infinity ? null : b;
      }
      return null;
    };
    const map = (rows: Row[]) => new Map(rows.map((r) => [r.name, r.n]));
    const e4 = map(sum('api_4xx', since));
    const e5 = map(sum('api_5xx', since));
    const lim = map(sum('limit', since));
    const api = sum('api', since).map((r) => ({
      route: r.name,
      n: r.n,
      e4: e4.get(r.name) ?? 0,
      e5: e5.get(r.name) ?? 0,
      limit: lim.get(r.name) ?? 0,
      // 이 시간 안에 끝난 요청이 절반(p50)·95%(p95). null = 10초 넘음 또는 기록 없음
      p50: pct(r.name, 0.5),
      p95: pct(r.name, 0.95),
    }));

    // 여행 현황 (지금 있는 여행, 지운 것 제외)
    const trips = db
      .prepare(
        // 샘플로 만든 여행은 빼고 (2026-11-02)
        "SELECT id, data_json FROM records WHERE table_name = 'trips' AND deleted_at IS NULL AND json_extract(data_json, '$.sample') IS NOT 1",
      )
      .all() as unknown as { id: string; data_json: string }[];
    const countries = new Map<string, number>();
    const cities = new Map<string, number>();
    let domestic = 0;
    const lengths: number[] = [];
    for (const t of trips) {
      const d = JSON.parse(t.data_json) as {
        destinations?: { name?: string; kind?: string; countryCode?: string }[];
        startDate?: string;
        endDate?: string;
      };
      const codes = [...new Set((d.destinations ?? []).flatMap((x) => x.countryCode ?? []))];
      for (const c of codes) countries.set(c, (countries.get(c) ?? 0) + 1);
      for (const x of d.destinations ?? [])
        if (x.kind === 'city' && x.name) cities.set(x.name, (cities.get(x.name) ?? 0) + 1);
      if (codes.length > 0 && codes.every((c) => c === 'KR')) domestic++;
      if (d.startDate && d.endDate)
        lengths.push(
          Math.round((Date.parse(d.endDate) - Date.parse(d.startDate)) / 86_400_000) + 1,
        );
    }
    const perTrip = (table: string) =>
      trips.length
        ? Math.round(
            (one(
              `SELECT COUNT(*) AS n FROM records r WHERE r.table_name = ? AND r.deleted_at IS NULL AND r.trip_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM records t WHERE t.table_name = 'trips' AND t.id = r.trip_id AND json_extract(t.data_json, '$.sample') = 1)`,
              table,
            ) /
              trips.length) *
              10,
          ) / 10
        : 0;
    const top = (m: Map<string, number>, n = 15): Row[] =>
      [...m.entries()]
        .map(([name, c]) => ({ name, n: c }))
        .sort((a, b) => b.n - a.n)
        .slice(0, n);
    const tripStats = {
      total: trips.length,
      domestic,
      countries: top(countries),
      cities: top(cities),
      avgDays: lengths.length
        ? Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) / 10
        : 0,
      perTrip: {
        items: perTrip('items'),
        bookings: perTrip('bookings'),
        checklistItems: perTrip('checklistItems'),
      },
      shared: one(
        'SELECT COUNT(*) AS n FROM (SELECT trip_id FROM trip_members GROUP BY trip_id HAVING COUNT(*) > 1)',
      ),
    };

    // 설정 켜진 비율 (계정에 동기화된 설정)
    const settingsRows = db.prepare('SELECT data_json FROM user_settings').all() as unknown as {
      data_json: string;
    }[];
    const featureOn = new Map<string, number>();
    const domesticMap = new Map<string, number>();
    let promptSeen = 0;
    let promptOn = 0;
    for (const r of settingsRows) {
      const s = JSON.parse(r.data_json) as Record<string, unknown>;
      for (const f of PLAN_FEATURES)
        if (s[f] === true) featureOn.set(f, (featureOn.get(f) ?? 0) + 1);
      if (typeof s.domesticMap === 'string')
        domesticMap.set(s.domesticMap, (domesticMap.get(s.domesticMap) ?? 0) + 1);
      const seen = Array.isArray(s.planPromptSeen) ? (s.planPromptSeen as string[]) : [];
      promptSeen += seen.length;
      promptOn += seen.filter((f) => s[f] === true).length;
    }
    const settings = {
      users: settingsRows.length,
      features: PLAN_FEATURES.map((f) => ({ name: f, n: featureOn.get(f) ?? 0 })),
      domesticMap: top(domesticMap),
      // 샘플 팝업에서 본 기능 중 지금 켜져 있는 것
      prompt: { seen: promptSeen, on: promptOn },
    };

    // 기기: 지금 살아 있는 로그인 기록의 브라우저 정보로 (기기 수 기준)
    const uas = db
      .prepare('SELECT user_agent FROM sessions WHERE expires_at > ?')
      .all(new Date().toISOString()) as unknown as { user_agent: string | null }[];
    const os = new Map<string, number>();
    const browser = new Map<string, number>();
    for (const { user_agent: ua } of uas) {
      const u = ua ?? '';
      const o = /iPhone|iPad/.test(u)
        ? 'iOS'
        : /Android/.test(u)
          ? 'Android'
          : /Windows/.test(u)
            ? 'Windows'
            : /Mac/.test(u)
              ? 'Mac'
              : 'other';
      const b = /KAKAOTALK/i.test(u)
        ? 'KakaoTalk'
        : /NAVER/.test(u)
          ? 'Naver'
          : /SamsungBrowser/.test(u)
            ? 'Samsung'
            : /Edg\//.test(u)
              ? 'Edge'
              : /CriOS|Chrome\//.test(u)
                ? 'Chrome'
                : /Safari\//.test(u)
                  ? 'Safari'
                  : /Firefox\//.test(u)
                    ? 'Firefox'
                    : 'other';
      os.set(o, (os.get(o) ?? 0) + 1);
      browser.set(b, (browser.get(b) ?? 0) + 1);
    }

    return {
      days,
      since,
      today,
      users,
      events: sum('event', since),
      // 기능을 쓴 기기 수 (기기마다 하루 한 번만 셈)
      reach: sum('reach', since),
      search: sum('search', since),
      env: sum('env', since),
      data: sum('data', since),
      sync: sum('sync', since),
      ai: sum('ai', since),
      api,
      trips: tripStats,
      settings,
      devices: { sessions: uas.length, os: top(os), browser: top(browser) },
    };
  }

  return { bump, markActive, request, summary };
}

export type StatsSummary = ReturnType<ReturnType<typeof statsRepo>['summary']>;
