import type { ItineraryItem, LocalDate, Trip } from '@trippocket/shared';
import { Minimize2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../shared/lib/cn';
import { IconButton } from '../../shared/ui';
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
import { placeSearchLinks } from '../../shared/lib/fallbackLinks';
import { FallbackLinks } from '../common/FallbackLinks';
import { OfflineNote } from '../common/OfflineNote';

/** "장소를 검색해 고른 일정만 표시" 안내는 이 기기에서 처음 한 번만 (사용자 요청 2026-10-24) */
const HINT_KEY = 'tp-map-hint-seen';
const HINT_MS = 5000;
const hintSeen = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};

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
export type MapSize = 'small' | 'large' | 'full';

/** 꾹 누르기로 보는 시간·허용 움직임 (지도를 끌면 취소) */
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE = 10;

export function TripMap({
  trip,
  items,
  dayIndexOf,
  onSelect,
  size = 'small',
  focus,
  onSizeChange,
}: {
  trip: Trip;
  items: readonly ItineraryItem[];
  dayIndexOf: (date: LocalDate) => number;
  onSelect: (item: ItineraryItem) => void;
  /** small = 일정 위 작은 지도(누르면 크게), large = 화면 대부분, full = 지도만 전체 화면 (꾹 누르기) */
  size?: MapSize;
  /** 크게 보기에서 고른 일정 — 지도를 그 핀으로 옮긴다 */
  focus?: ItineraryItem | undefined;
  onSizeChange?: (size: MapSize) => void;
}) {
  const { t } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'paused'>('loading');
  const pref = useSettings((s) => s.inAppMap);
  const provider = chooseProvider(trip.mapProvider ?? pref, isDomesticTrip(trip));
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const [hintDone, setHintDone] = useState(hintSeen);

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

  const showHint = status === 'ready' && visible.length === 0 && !hintDone;
  // 처음 보여 준 순간 "봤음"으로 남기고, 잠시 뒤 사라진다
  useEffect(() => {
    if (!showHint) return;
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // 저장 못 해도 이번에는 잠시 뒤 사라진다
    }
    const timer = setTimeout(() => setHintDone(true), HINT_MS);
    return () => clearTimeout(timer);
  }, [showHint]);

  // 상자 크기가 바뀌면(작게·크게·전체) 지도를 다시 그리고 핀이 모두 보이게
  useEffect(() => {
    const h = handle.current;
    if (!h || status !== 'ready') return;
    const id = requestAnimationFrame(() => {
      h.resize();
      if (!focus?.place?.coords) h.fitBounds(latest.current.visible.map((i) => i.place!.coords!));
    });
    return () => cancelAnimationFrame(id);
    // focus는 아래 효과가 맡는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, status]);

  // 크게 보기에서 일정을 넘기면 그 핀으로
  const focusCoords = focus?.place?.coords;
  useEffect(() => {
    if (focusCoords && status === 'ready') handle.current?.panTo(focusCoords);
  }, [focusCoords?.lat, focusCoords?.lng, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // 꾹 누르기 → 전체 화면. 지도를 끌거나 손을 떼면 취소. 지도 안의 손가락 처리보다 먼저 보도록 capture 단계에서
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  // 꾹 누른 뒤 손을 떼면 따라오는 click은 "크게 보기"로 받지 않는다
  const longPressed = useRef(false);
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const pressHandlers = onSizeChange
    ? {
        onPointerDownCapture: (e: React.PointerEvent) => {
          longPressed.current = false;
          if (size === 'full') return;
          cancelPress();
          press.current = {
            x: e.clientX,
            y: e.clientY,
            timer: window.setTimeout(() => {
              press.current = null;
              longPressed.current = true;
              onSizeChange('full');
            }, LONG_PRESS_MS),
          };
        },
        onPointerMoveCapture: (e: React.PointerEvent) => {
          const p = press.current;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_MOVE) cancelPress();
        },
        onPointerUpCapture: cancelPress,
        onPointerCancelCapture: cancelPress,
        // 휴대폰에서 꾹 누르면 뜨는 메뉴 대신
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      }
    : {};
  useEffect(() => cancelPress, []);

  const message = !online
    ? t('map.offline')
    : !provider
      ? t('map.noKey')
      : status === 'error'
        ? t('map.error')
        : status === 'paused'
          ? t('map.paused')
          : showHint
            ? t('map.noPlaces')
            : null;

  return (
    <div
      {...pressHandlers}
      className={cn(
        'overflow-hidden bg-bg-subtle',
        size === 'full'
          ? 'fixed inset-0 z-50'
          : cn(
              'relative rounded-2xl border border-line transition-[height] duration-200',
              size === 'large' ? 'h-[58dvh]' : 'h-60',
            ),
      )}
      {...(size === 'full'
        ? { role: 'dialog', 'aria-modal': true, 'aria-label': t('map.fullTitle') }
        : {})}
    >
      <div ref={el} className="absolute inset-0" aria-label={t('map.label')} role="region" />
      {/* 작은 지도: 누르면 크게 (지도를 바로 움직이지 않고, 크게 본 뒤 움직인다) */}
      {size === 'small' && onSizeChange && status === 'ready' && (
        <button
          type="button"
          onClick={() => {
            if (longPressed.current) longPressed.current = false;
            else onSizeChange('large');
          }}
          aria-label={t('map.expand')}
          className="absolute inset-0 z-[1] cursor-zoom-in"
        />
      )}
      {size === 'large' && onSizeChange && (
        <button
          type="button"
          onClick={() => onSizeChange('small')}
          className="absolute top-2 left-2 z-[1] flex h-9 items-center gap-1 rounded-full bg-surface/95 px-3 text-caption font-semibold shadow"
        >
          <Minimize2 aria-hidden="true" className="size-4" />
          {t('map.shrink')}
        </button>
      )}
      {size === 'full' && onSizeChange && (
        <IconButton
          label={t('map.closeFull')}
          icon={<X />}
          onClick={() => onSizeChange('large')}
          className="absolute top-[calc(env(safe-area-inset-top)+8px)] right-[calc(env(safe-area-inset-right)+8px)] z-[1] bg-surface/95 shadow"
        />
      )}
      {message && (
        <div className="absolute inset-x-3 bottom-3 z-[1] flex flex-col items-center gap-1.5 rounded-btn bg-surface/95 px-3 py-2 text-center text-caption whitespace-pre-line text-fg-sub shadow">
          {!online ? <OfflineNote text={message} /> : message}
          {/* 무료 사용량으로 멈췄으면 지도 서비스에서 직접 (사용자 요청 2026-10-25) */}
          {status === 'paused' && (
            <FallbackLinks
              links={placeSearchLinks(
                trip.destinations[0]?.name ?? trip.title,
                isDomesticTrip(trip),
              )}
            />
          )}
        </div>
      )}
      {size !== 'full' && onSizeChange && status === 'ready' && !message && (
        <p className="pointer-events-none absolute right-2 bottom-2 z-[1] rounded-full bg-surface/90 px-2 py-0.5 text-micro text-fg-muted">
          {t('map.longPressHint')}
        </p>
      )}
    </div>
  );
}
