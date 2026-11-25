import type { ItineraryItem } from '@trippocket/shared';
import i18n from '../i18n';
import { formatTemps, weatherLook } from './weather';

/**
 * 일정표 출력·공유의 날짜 줄 (2026-11-25 사용자 요청 "일자 옆에 날씨, 과거 예보 포함").
 * 화면 없는 계산만 — 날씨 한 줄, 상세 출력 지도 점
 */
export interface PrintWeather {
  code: number;
  min: number;
  max: number;
  /** 작년 같은 날 기록이면 그 해 */
  year?: number | undefined;
  /** 이미 지난 날 (실제 날씨) */
  past?: true | undefined;
}

/** "맑음 12°/20°" + 지난 날이면 "· 지난 날씨", 작년 기록이면 "· 작년 기록" */
export function weatherText(w: PrintWeather | undefined): string | null {
  if (!w) return null;
  const base = `${weatherLook(w.code).label} ${formatTemps(w)}`;
  if (w.year)
    return `${base} · ${i18n.t('print.weatherLastYear', { yy: String(w.year).slice(2) })}`;
  if (w.past) return `${base} · ${i18n.t('print.weatherActual')}`;
  return base;
}

/**
 * 상세 출력 일차 지도 점: 일정 목록 번호(메모·좌표 없는 일정도 센다)를 그대로, 좌표 있는 장소만.
 * 서버 `/api/maps/static` 주소에 넣는 "위도,경도,번호;…" (일정 장소 좌표 — 사용자 위치 아님)
 */
export function mapPointsParam(dayItems: readonly ItineraryItem[]): string | null {
  const pts = dayItems
    .map((i, n) => ({ i, n: n + 1 }))
    .filter(({ i }) => i.kind !== 'note' && i.place?.coords)
    .slice(0, 25)
    .map(
      ({ i, n }) => `${i.place!.coords!.lat.toFixed(5)},${i.place!.coords!.lng.toFixed(5)},${n}`,
    );
  return pts.length ? pts.join(';') : null;
}
