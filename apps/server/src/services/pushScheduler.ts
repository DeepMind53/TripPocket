import { daysUntil, essentialKey, essentialsFor, todayIn } from '@trippocket/shared';
import type { Db } from '../db/database';
import { planAlertPushes } from './alertPush';
import type { NationalKeys } from './nationalAlerts';
import { sendPush, type PushMessage, type PushKind } from './push';

interface TripData {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  timezone: string;
  destinations?: { countryCode?: string }[];
}
interface ItemData {
  id: string;
  date: string | null;
  title: string;
  startTime?: string;
  done?: boolean;
}

/** 그 시간대의 지금 "HH:mm" */
const hhmmIn = (tz: string, now: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export interface PlannedPush {
  userId: string;
  kind: PushKind;
  key: string;
  msg: PushMessage;
}

/**
 * 지금 보낼 알림 계산 (순수 함수에 가깝게 — DB 읽기만). 5분마다 불린다 (docs/20 G1)
 * - 출발 하루 전 (현지 09시 이후)
 * - 입국신고를 낼 수 있게 된 날 (필수 항목 fromDaysBefore, 현지 09시 이후, 아직 체크 안 함)
 * - 일정 시작 30분 전 (오늘, 시작 시각 있는 일정, 안 다녀온 것)
 * 같은 알림은 push_sent로 한 번만
 */
export function planPushes(db: Db, now: Date): PlannedPush[] {
  const users = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all() as {
    user_id: string;
  }[];
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
      let local: string;
      try {
        today = todayIn(trip.timezone, now);
        local = hhmmIn(trip.timezone, now);
      } catch {
        continue;
      }
      if (today > trip.endDate) continue;
      const left = daysUntil(trip.startDate, today);
      const base = `/trips/${trip.id}`;

      if (left === 1 && local >= '09:00')
        out.push({
          userId,
          kind: 'departure',
          key: `dep:${trip.id}:${trip.startDate}`,
          msg: {
            title: `내일 ${trip.title} 출발이에요 ✈️`,
            body: '필수 항목을 한 번 더 확인하세요',
            url: `${base}/essentials`,
          },
        });

      if (left >= 0 && local >= '09:00') {
        const checked = new Set(
          (
            db
              .prepare(
                `SELECT data_json FROM records WHERE table_name = 'checklistItems' AND trip_id = ? AND deleted_at IS NULL`,
              )
              .all(trip.id) as { data_json: string }[]
          )
            .map((r) => JSON.parse(r.data_json) as { list: string; text: string; checked: boolean })
            .filter((c) => c.list === 'essentials' && c.checked)
            .map((c) => c.text),
        );
        const codes = [
          ...new Set(
            (trip.destinations ?? []).flatMap((d) => (d.countryCode ? [d.countryCode] : [])),
          ),
        ];
        for (const code of codes) {
          const data = essentialsFor(code);
          for (const item of data?.items ?? []) {
            if (item.fromDaysBefore === undefined || left > item.fromDaysBefore) continue;
            if (checked.has(essentialKey(code, item.id))) continue;
            out.push({
              userId,
              kind: 'entry',
              key: `entry:${trip.id}:${code}:${item.id}`,
              msg: {
                title: `${data!.name} ${item.title}`,
                body: '지금 제출할 수 있어요',
                url: `${base}/essentials`,
              },
            });
          }
        }
      }

      if (today >= trip.startDate) {
        const items = (
          db
            .prepare(
              `SELECT data_json FROM records WHERE table_name = 'items' AND trip_id = ? AND deleted_at IS NULL`,
            )
            .all(trip.id) as { data_json: string }[]
        ).map((r) => JSON.parse(r.data_json) as ItemData);
        for (const it of items) {
          if (it.date !== today || !it.startTime || it.done) continue;
          const diff = minutes(it.startTime) - minutes(local);
          if (diff < 0 || diff > 30) continue;
          out.push({
            userId,
            kind: 'itemSoon',
            key: `soon:${it.id}:${today}`,
            msg: {
              title: `${it.startTime} ${it.title}`,
              body: `${diff}분 뒤에 시작해요`,
              url: `${base}/plan`,
            },
          });
        }
      }
    }
  }
  return out;
}

/** 5분마다 계산해 보낸다 (여행지 특보는 30분마다). 반환값으로 멈춤 */
export function schedulePushes(
  db: Db,
  log: (m: string) => void,
  alertKeys: NationalKeys = {},
): () => void {
  let n = 0;
  const tick = async () => {
    try {
      for (const p of planPushes(db, new Date()))
        await sendPush(db, p.userId, p.kind, p.msg, p.key);
      if (n++ % 6 === 0)
        for (const p of await planAlertPushes(db, alertKeys, new Date()))
          await sendPush(db, p.userId, p.kind, p.msg, p.key);
      // 30일 지난 발송 기록 정리
      db.prepare('DELETE FROM push_sent WHERE sent_at < ?').run(
        new Date(Date.now() - 30 * 86_400_000).toISOString(),
      );
    } catch (e) {
      log(`알림 보내기 실패: ${String(e)}`);
    }
  };
  const id = setInterval(() => void tick(), 5 * 60_000);
  id.unref();
  void tick();
  return () => clearInterval(id);
}
