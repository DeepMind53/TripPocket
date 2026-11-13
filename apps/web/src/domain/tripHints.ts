import { distanceKm, type Coords } from '@trippocket/shared';
import { weatherLook, type DayWeather } from './weather';

/**
 * 2026-11-13 실험실에서 정식 (설정 "일정"): 오늘의 한마디·걷기 좋은 시간·해 지기까지·더 짧은 순서.
 * 서버·외부 요청 없이 기기에 있는 정보로 계산. 화면은 home/TodayTips·itinerary/ShorterOrderHint
 */

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** 오늘의 한마디: 여행 N일차마다 다른 문장 (ids 순서대로 돌아감) */
export function phraseOfDay<T>(ids: readonly T[], dayN: number): T {
  return ids[(((dayN - 1) % ids.length) + ids.length) % ids.length]!;
}

/**
 * 걷기 좋은 시간: 지금 시 ~ 21시 중 비·눈·뇌우가 없고 8~27°인 시간이 2시간 넘게 이어지는 가장 긴 구간.
 * 같은 길이면 이른 쪽. to = 끝나는 시 (14~17시 = 14·15·16시)
 */
export function bestWalkWindow(
  hours: DayWeather['hours'],
  fromHour: number,
): { from: number; to: number } | null {
  if (!hours) return null;
  const good = (h: number) => {
    const c = hours.code[h];
    const t = hours.temp[h];
    if (c === undefined || t === undefined) return false;
    const k = weatherLook(c).kind;
    return k !== 'rain' && k !== 'drizzle' && k !== 'storm' && k !== 'snow' && t >= 8 && t <= 27;
  };
  let best: { from: number; to: number } | null = null;
  let start = -1;
  for (let h = Math.max(0, fromHour); h <= 21; h++) {
    if (good(h)) {
      if (start < 0) start = h;
      if (!best || h + 1 - start > best.to - best.from) best = { from: start, to: h + 1 };
    } else start = -1;
  }
  return best && best.to - best.from >= 2 ? best : null;
}

/** 해 지기까지 남은 분 (이미 졌거나 3시간보다 많이 남으면 null — 늦은 오후에만) */
export function daylightLeft(now: string, sunset: string): number | null {
  const m = mins(sunset) - mins(now);
  return m > 0 && m <= 180 ? m : null;
}

type Spot = { id: string; title: string; coords: Coords };

const pathKm = (list: readonly Spot[]) =>
  list.reduce((sum, s, i) => (i === 0 ? 0 : sum + distanceKm(list[i - 1]!.coords, s.coords)), 0);

/**
 * 더 짧은 순서: 첫 장소는 그대로 두고, 남은 곳을 가장 가까운 곳부터 차례로 이었을 때
 * 직선 합이 1km 넘게, 15% 넘게 줄면 그 순서 (장소 3곳부터). 바꾸지는 않고 알려만 준다
 */
export function shorterOrder(spots: readonly Spot[]): { titles: string[]; saveKm: number } | null {
  if (spots.length < 3) return null;
  const rest = spots.slice(1);
  const out: Spot[] = [spots[0]!];
  while (rest.length) {
    const last = out[out.length - 1]!;
    let k = 0;
    for (let i = 1; i < rest.length; i++)
      if (distanceKm(last.coords, rest[i]!.coords) < distanceKm(last.coords, rest[k]!.coords))
        k = i;
    out.push(rest.splice(k, 1)[0]!);
  }
  const now = pathKm(spots);
  const better = pathKm(out);
  const save = now - better;
  if (save < 1 || save / now < 0.15) return null;
  return { titles: out.map((s) => s.title), saveKm: Math.round(save * 10) / 10 };
}
