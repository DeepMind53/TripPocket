import {
  addDays,
  alertQuery,
  notableAlerts,
  pointsByCountry,
  todayIn,
  type DestinationAlert,
} from '@trippocket/shared';
import type { Db } from '../db/database';
import { alertsFor } from './alerts';
import type { NationalKeys } from './nationalAlerts';
import type { PlannedPush } from './pushScheduler';

interface TripData {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  timezone: string;
  destinations?: { countryCode?: string; coords?: { lat: number; lng: number } }[];
}

const KIND_KO: Record<string, string> = {
  cyclone: '태풍',
  earthquake: '지진',
  flood: '홍수',
  volcano: '화산',
  wildfire: '산불',
};

/** 알림 한 줄 — 공식 출처 이름 그대로 (자체 판단 문구 없음, docs/24 §5) */
export function describeAlert(a: DestinationAlert): string {
  if (a.source === 'mofa')
    return a.special === 'forbidden'
      ? '외교부 특별여행경보'
      : a.special === 'evacuate'
        ? '외교부 특별여행주의보'
        : `외교부 여행경보 ${a.step ?? ''}단계`;
  if (a.kind === 'weather') return a.names?.join(' · ') || a.title;
  if (a.source === 'usgs') return `지진 규모 ${a.magnitude?.toFixed(1) ?? ''}`;
  return `${KIND_KO[a.kind] ?? a.title} 빨강 경보`;
}

/** 보낼 알림 + 보내지면 "알렸음"으로 남길 특보 키 */
export interface AlertPush extends PlannedPush {
  markKeys: string[];
}

/**
 * 여행지 특보 알림 (docs/24 §2-3, ADR-0008 결정 4): 출발 7일 전 ~ 귀국일인 여행에
 * 빨강 특보(외교부 상시 단계 제외)가 **새로** 생기면 알림 1번 — 여행 1개당 하루 1번까지.
 * - 특보는 여행마다 한 번만 묻는다(함께 쓰는 사람이 여럿이어도), 여행끼리는 동시에
 * - "알렸음" 기록은 실제로 보낸 뒤에 남긴다(markKeys) — 못 보냈거나 오늘 이미 보냈으면 내일 다시 후보
 */
export async function planAlertPushes(db: Db, keys: NationalKeys, now: Date): Promise<AlertPush[]> {
  const rows = db
    .prepare(
      `SELECT DISTINCT m.user_id, r.id, r.data_json FROM push_subscriptions s
       JOIN trip_members m ON m.user_id = s.user_id
       JOIN records r ON r.table_name = 'trips' AND r.id = m.trip_id AND r.deleted_at IS NULL`,
    )
    .all() as { user_id: string; id: string; data_json: string }[];

  const trips = new Map<string, { trip: TripData; today: string; users: string[] }>();
  for (const r of rows) {
    const hit = trips.get(r.id);
    if (hit) {
      hit.users.push(r.user_id);
      continue;
    }
    const trip = JSON.parse(r.data_json) as TripData;
    let today: string;
    try {
      today = todayIn(trip.timezone, now);
    } catch {
      continue;
    }
    if (today > trip.endDate || today < addDays(trip.startDate, -7)) continue;
    trips.set(r.id, { trip, today, users: [r.user_id] });
  }

  const sent = db.prepare('SELECT 1 FROM push_sent WHERE user_id = ? AND key = ?');
  const perTrip = await Promise.all(
    [...trips.values()].map(async ({ trip, today, users }) => {
      const { countries, points } = alertQuery(trip);
      if (!countries.length) return [];
      const { alerts } = await alertsFor(countries, keys, pointsByCountry(points));
      const red = notableAlerts(alerts).filter((a) => a.level === 'red');
      return users.flatMap((userId): AlertPush[] => {
        const fresh = red.filter((a) => !sent.get(userId, `alert:${trip.id}:${a.id}`));
        const day = `alertday:${trip.id}:${today}`;
        if (!fresh.length || sent.get(userId, day)) return [];
        const first = fresh[0]!;
        return [
          {
            userId,
            kind: 'alert',
            key: day,
            markKeys: fresh.map((a) => `alert:${trip.id}:${a.id}`),
            msg: {
              title: `⚠️ ${trip.title} 여행지 특보`,
              body: `${describeAlert(first)}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ''}\n날씨 정보에서 공식 발표를 확인하세요`,
              url: `/trips/${trip.id}/weather`,
            },
          },
        ];
      });
    }),
  );
  return perTrip.flat();
}

/** 보낸 알림의 특보를 "알렸음"으로 */
export function markAlertsSent(db: Db, p: AlertPush, now: Date): void {
  const mark = db.prepare(
    'INSERT OR IGNORE INTO push_sent (user_id, key, sent_at) VALUES (?, ?, ?)',
  );
  for (const k of p.markKeys) mark.run(p.userId, k, now.toISOString());
}
