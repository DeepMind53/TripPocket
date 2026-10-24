import type { ItineraryItem, LocalDate, Trip } from '@trippocket/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../data/settingsStore';
import { isDomesticTrip } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';
import {
  chooseProvider,
  mountMap,
  type LatLng,
  type MapHandle,
  type MapMarker,
} from '../../shared/maps';
import { compareKeys } from '@trippocket/shared';
import { mapAllowed, reportMapLoad } from '../../data/api/usage';

/** 날짜 색 토큰 → 실제 색 (지도 핀 SVG는 CSS 변수를 못 쓴다) */
const dayHex = (index: number) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(`--tp-day-${(index % 8) + 1}`)
    .trim() || '#2F6BFF';

/**
 * S-10 위쪽 지도 (17단계): 일차별 색 번호 핀 + 순서선, 핀을 누르면 그 일정 상세.
 * 지도 SDK는 지도를 열 때만 불러오고(무료 사용량 절약), 오프라인·키 없음은 안내만.
 * Google 약관: Google에서 받은 좌표는 네이버 지도 위에 올리지 않는다 (docs/10 §2.1)
 */
export function TripMap({
  trip,
  items,
  dayIndexOf,
  onSelect,
}: {
  trip: Trip;
  items: readonly ItineraryItem[];
  dayIndexOf: (date: LocalDate) => number;
  onSelect: (item: ItineraryItem) => void;
}) {
  const { t } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'paused'>('loading');
  const pref = useSettings((s) => s.inAppMap);
  const provider = chooseProvider(trip.mapProvider ?? pref, isDomesticTrip(trip));
  const online = typeof navigator === 'undefined' || navigator.onLine;

  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          i.date && i.place?.coords && !(provider === 'naver' && i.place.coordsSource === 'google'),
      ),
    [items, provider],
  );

  // 지도 만들기 (제공자가 바뀔 때만)
  useEffect(() => {
    if (!provider || !online || !el.current) return;
    let alive = true;
    const center: LatLng = trip.destinations.find((d) => d.coords)?.coords ?? {
      lat: 37.5665,
      lng: 126.978,
    };
    const target = el.current;
    // Google 지도는 유료 가능 API — 관리자가 멈췄거나 이번 달 상한이면 열지 않는다 (API 사용량)
    void mapAllowed(provider).then((ok) => {
      if (!alive) return;
      if (!ok) return setStatus('paused');
      mountMap(provider, target, { center, zoom: 12 }).then(
        (h) => {
          if (!alive) return h.destroy();
          handle.current = h;
          setStatus('ready');
          reportMapLoad(provider);
        },
        () => alive && setStatus('error'),
      );
    });
    return () => {
      alive = false;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [provider, online, trip.destinations]);

  // 화면이 다시 그려질 때마다 바뀌는 함수·배열 대신, 실제 장소가 바뀔 때만 핀을 다시 그린다
  const latest = useRef({ visible, dayIndexOf, onSelect });
  useEffect(() => {
    latest.current = { visible, dayIndexOf, onSelect };
  });
  const signature = visible
    .map((i) => `${i.id}:${i.date}:${i.order}:${i.place?.coords?.lat},${i.place?.coords?.lng}`)
    .join('|');

  // 핀·순서선 (장소·순서가 바뀔 때)
  useEffect(() => {
    const h = handle.current;
    if (!h || status !== 'ready') return;
    const { visible, dayIndexOf, onSelect } = latest.current;
    const byDay = new Map<LocalDate, ItineraryItem[]>();
    for (const i of visible) byDay.set(i.date!, [...(byDay.get(i.date!) ?? []), i]);
    const markers: MapMarker[] = [];
    const paths: { color: string; points: LatLng[] }[] = [];
    for (const [date, list] of byDay) {
      const color = dayHex(dayIndexOf(date));
      const sorted = [...list].sort((a, b) => compareKeys(a.order, b.order));
      sorted.forEach((i, n) =>
        markers.push({
          id: i.id,
          position: i.place!.coords!,
          label: String(n + 1),
          color,
          title: i.title,
        }),
      );
      paths.push({ color, points: sorted.map((i) => i.place!.coords!) });
    }
    h.setMarkers(markers);
    h.drawPaths(paths);
    h.fitBounds(markers.map((m) => m.position));
    h.onMarkerClick((id) => {
      const item = visible.find((i) => i.id === id);
      if (item) onSelect(item);
    });
  }, [signature, status]);

  const message = !online
    ? t('map.offline')
    : !provider
      ? t('map.noKey')
      : status === 'error'
        ? t('map.error')
        : status === 'paused'
          ? t('map.paused')
          : status === 'ready' && visible.length === 0
            ? t('map.noPlaces')
            : null;

  return (
    <div className="relative h-60 overflow-hidden rounded-2xl border border-line bg-bg-subtle">
      <div ref={el} className="absolute inset-0" aria-label={t('map.label')} role="region" />
      {message && (
        <p className="absolute inset-x-3 bottom-3 rounded-btn bg-surface/95 px-3 py-2 text-center text-caption text-fg-sub shadow">
          {message}
        </p>
      )}
    </div>
  );
}
