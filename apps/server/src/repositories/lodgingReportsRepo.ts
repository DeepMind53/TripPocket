import {
  LODGING_TAGS,
  REPORT_RULES,
  uuidv7,
  type LodgingReportInput,
  type LodgingReportView,
  type LodgingTag,
} from '@trippocket/shared';
import type { Db } from '../db/database';
import { statDate } from './statsRepo';

/**
 * 숙소 가격 기록 (docs/28 §7, ADR-0010): 이 파일만 lodging_price_reports를 읽고 쓴다.
 * 작성자 id는 내 기록 삭제·한도에만 쓰고 목록에는 mine만 내보낸다
 */
interface Row {
  id: string;
  user_id: string;
  hotel_key: string;
  hotel_name: string;
  city: string | null;
  check_in: string;
  nights: number;
  adults: number;
  rooms: number;
  site: string;
  route: string | null;
  price: number;
  price_type: string;
  currency: string;
  tax: string;
  tags: string;
  seen_at: string;
  expires_at: string;
}

const DAY = 86_400_000;

function view(r: Row, me: string): LodgingReportView {
  const tags = r.tags
    .split(',')
    .filter((x): x is LodgingTag => (LODGING_TAGS as readonly string[]).includes(x));
  return {
    id: r.id,
    hotelKey: r.hotel_key,
    hotelName: r.hotel_name,
    ...(r.city ? { city: r.city } : {}),
    checkIn: r.check_in,
    nights: r.nights,
    adults: r.adults,
    rooms: r.rooms,
    site: r.site as LodgingReportView['site'],
    ...(r.route ? { route: r.route } : {}),
    price: r.price,
    priceType: r.price_type as LodgingReportView['priceType'],
    currency: r.currency,
    tax: r.tax as LodgingReportView['tax'],
    tags,
    // 본 시각은 날짜만 (Q10 확정) — 한국 날짜
    seenOn: statDate(new Date(r.seen_at)),
    mine: r.user_id === me,
  };
}

export function lodgingReportsRepo(db: Db) {
  return {
    /** 그 숙소의 30일 안 기록: 같은 날짜·인원 먼저, 그 안에서 최근 순 (가격 순 정렬은 화면에서 — 통화 환산) */
    list(
      hotelKeys: readonly string[],
      me: string,
      stay: { checkIn?: string; nights?: number; adults?: number },
      now = Date.now(),
    ): LodgingReportView[] {
      const keys = hotelKeys.slice(0, 2);
      const rows = db
        .prepare(
          `SELECT * FROM lodging_price_reports WHERE hotel_key IN (${keys.map(() => '?').join(',')})
           AND expires_at > ?
           ORDER BY (check_in = ? AND nights = ? AND adults = ?) DESC, seen_at DESC LIMIT ?`,
        )
        .all(
          ...keys,
          new Date(now).toISOString(),
          stay.checkIn ?? '',
          stay.nights ?? 0,
          stay.adults ?? 0,
          REPORT_RULES.listMax,
        ) as unknown as Row[];
      return rows.map((r) => view(r, me));
    },

    /** 오늘(한국 날짜) 이 사람이 적은 수 */
    countToday(userId: string, now = Date.now()): number {
      const start = new Date(`${statDate(new Date(now))}T00:00:00+09:00`).toISOString();
      return Number(
        (
          db
            .prepare(
              'SELECT COUNT(*) AS n FROM lodging_price_reports WHERE user_id = ? AND seen_at >= ?',
            )
            .get(userId, start) as { n: number }
        ).n,
      );
    },

    /**
     * 적기: 같은 사람·숙소·날짜·인원·앱·경로를 1시간 안에 다시 적으면 덮어쓴다.
     * 숙소마다 300줄, 표 전체 5만 줄을 넘으면 오래된 것부터 지운다
     */
    save(userId: string, input: LodgingReportInput, now = Date.now()): LodgingReportView {
      const seenAt = new Date(now).toISOString();
      const expiresAt = new Date(now + REPORT_RULES.keepDays * DAY).toISOString();
      const recent = db
        .prepare(
          `SELECT id FROM lodging_price_reports WHERE user_id = ? AND hotel_key = ? AND check_in = ?
           AND nights = ? AND adults = ? AND rooms = ? AND site = ? AND COALESCE(route, '') = ? AND seen_at > ?`,
        )
        .get(
          userId,
          input.hotelKey,
          input.checkIn,
          input.nights,
          input.adults,
          input.rooms,
          input.site,
          input.route ?? '',
          new Date(now - REPORT_RULES.overwriteMs).toISOString(),
        ) as { id: string } | undefined;
      const id = recent?.id ?? uuidv7();
      db.exec('BEGIN');
      try {
        db.prepare(
          `INSERT INTO lodging_price_reports (id, user_id, hotel_key, hotel_name, city, check_in, nights, adults,
             rooms, site, route, price, price_type, currency, tax, tags, seen_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET hotel_name = excluded.hotel_name, city = excluded.city,
             price = excluded.price, price_type = excluded.price_type, currency = excluded.currency,
             tax = excluded.tax, tags = excluded.tags, seen_at = excluded.seen_at, expires_at = excluded.expires_at`,
        ).run(
          id,
          userId,
          input.hotelKey,
          input.hotelName.trim(),
          input.city?.trim() || null,
          input.checkIn,
          input.nights,
          input.adults,
          input.rooms,
          input.site,
          input.route ?? null,
          input.price,
          input.priceType,
          input.currency,
          input.tax,
          [...new Set(input.tags)].join(','),
          seenAt,
          expiresAt,
        );
        db.prepare(
          `DELETE FROM lodging_price_reports WHERE hotel_key = ? AND id NOT IN (
             SELECT id FROM lodging_price_reports WHERE hotel_key = ? ORDER BY seen_at DESC LIMIT ?)`,
        ).run(input.hotelKey, input.hotelKey, REPORT_RULES.perHotel);
        db.prepare(
          `DELETE FROM lodging_price_reports WHERE id NOT IN (
             SELECT id FROM lodging_price_reports ORDER BY seen_at DESC LIMIT ?)`,
        ).run(REPORT_RULES.total);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      const row = db
        .prepare('SELECT * FROM lodging_price_reports WHERE id = ?')
        .get(id) as unknown as Row;
      return view(row, userId);
    },

    /** 내 기록만 지운다 (관리자는 모두) */
    remove(id: string, userId: string, admin = false): boolean {
      const res = admin
        ? db.prepare('DELETE FROM lodging_price_reports WHERE id = ?').run(id)
        : db
            .prepare('DELETE FROM lodging_price_reports WHERE id = ? AND user_id = ?')
            .run(id, userId);
      return Number(res.changes) > 0;
    },

    /** 30일 지난 기록 정리 (services/maintenance.ts) */
    purgeExpired(now = Date.now()): number {
      return Number(
        db
          .prepare('DELETE FROM lodging_price_reports WHERE expires_at <= ?')
          .run(new Date(now).toISOString()).changes,
      );
    },

    /** 관리자: 개수 + 최근 기록 (작성자 없이) */
    adminSummary(limit = 50): { total: number; recent: LodgingReportView[] } {
      const total = Number(
        (db.prepare('SELECT COUNT(*) AS n FROM lodging_price_reports').get() as { n: number }).n,
      );
      const rows = db
        .prepare('SELECT * FROM lodging_price_reports ORDER BY seen_at DESC LIMIT ?')
        .all(limit) as unknown as Row[];
      return { total, recent: rows.map((r) => view(r, '')) };
    },
  };
}
