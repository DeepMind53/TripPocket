import {
  addDays,
  POINT_ALERT_COUNTRIES,
  roundAlertPoint,
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

/**
 * 여행지 특보 알림 (docs/24 §2-3, ADR-0008 결정 4): 출발 7일 전 ~ 귀국일인 여행에
 * 빨강 등급 특보가 **새로** 생기면 알림 1번 — 여행 1개당 하루 1번까지.
 * 외교부 여행경보는 거의 바뀌지 않는 상시 정보라 알림에서 뺀다 (특별여행주의보·경보는 포함)
 */
export async function planAlertPushes(
  db: Db,
  keys: NationalKeys,
  now: Date,
): Promise<PlannedPush[]> {
  const users = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all() as {
    user_id: string;
  }[];
  const sent = db.prepare('SELECT 1 FROM push_sent WHERE user_id = ? AND key = ?');
  const mark = db.prepare(
    'INSERT OR IGNORE INTO push_sent (user_id, key, sent_at) VALUES (?, ?, ?)',
  );
  const out: PlannedPush[] = [];
  for (const { user_id: userId } of users) {
    const trips = (
      db
        .prepare(
          `SELECT r.data_json FROM records r JOIN trip_members m ON m.trip_id = r.id
           WHERE r.table_name = 'trips' AND r.deleted_at IS NULL AND m.user_id = ?`,
        )
        .all(userId) as { data_json: string }[]
    ).map((r) => JSON.parse(r.data_json) as TripData);
    for (const trip of trips) {
      let today: string;
      try {
        today = todayIn(trip.timezone, now);
      } catch {
        continue;
      }
      if (today > trip.endDate || today < addDays(trip.startDate, -7)) continue;
      const dests = trip.destinations ?? [];
      const countries = [...new Set(dests.flatMap((d) => (d.countryCode ? [d.countryCode] : [])))];
      if (!countries.length) continue;
      const points = new Map<string, [number, number][]>();
      for (const d of dests)
        if (d.countryCode && d.coords && POINT_ALERT_COUNTRIES.includes(d.countryCode))
          points.set(d.countryCode, [
            ...(points.get(d.countryCode) ?? []),
            [roundAlertPoint(d.coords.lat), roundAlertPoint(d.coords.lng)],
          ]);
      const { alerts } = await alertsFor(countries, keys, points);
      const fresh = alerts.filter(
        (a) =>
          a.level === 'red' &&
          !(a.source === 'mofa' && !a.special) &&
          !sent.get(userId, `alert:${trip.id}:${a.id}`),
      );
      if (!fresh.length) continue;
      // 새 특보는 모두 "알렸음"으로 (내일 같은 것을 다시 알리지 않게)
      const at = now.toISOString();
      for (const a of fresh) mark.run(userId, `alert:${trip.id}:${a.id}`, at);
      const day = `alertday:${trip.id}:${today}`;
      if (sent.get(userId, day)) continue;
      const first = fresh[0]!;
      out.push({
        userId,
        kind: 'alert',
        key: day,
        msg: {
          title: `⚠️ ${trip.title} 여행지 특보`,
          body: `${describeAlert(first)}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ''}\n날씨 정보에서 공식 발표를 확인하세요`,
          url: `/trips/${trip.id}/weather`,
        },
      });
    }
  }
  return out;
}
