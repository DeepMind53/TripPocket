import {
  distanceKm,
  walkMinutes,
  type Coords,
  type ItineraryItem,
  type RouteEta,
} from '@trippocket/shared';
import { LocateFixed, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { routeEta } from '../../data/api/routes';
import { FAR_LEG_KM, LEAVE_MARGIN_MIN, departurePlan } from '../../domain/dayTools';
import { useTranslation } from '../../i18n';
import { useCurrentPosition } from '../../shared/hooks/useCurrentPosition';
import { cn } from '../../shared/lib/cn';

/** 이보다 오래 걸으면 도보로 가는 길이 아니다 → "도보 검색 불가" */
const MAX_WALK_MIN = 200;

interface Found {
  /** 어느 다음 일정의 결과인지 (다음 일정이 바뀌면 다시 눌러야 한다) */
  nextId: string;
  /** 몇 번째 누름의 결과인지 */
  press: number;
  here: Coords;
  eta: RouteEta | null;
  /** 비행기로 건너갈 만큼 멀거나 다음 일정이 항공편 → 시간을 묻지 않았다 */
  far: boolean;
}

/**
 * 일정 화면 지도·편집 사이 "다음 일정" 줄 (사용자 요청 2026-10-27): 여행 당일 지금 위치에서
 * 다음 일정까지 실제 걷는 길·대중교통 시간과 몇 시까지 나가면 되는지.
 * 길 찾기는 [이동 시간 검색]을 누를 때만 한 번 (자동·반복 검색은 API 낭비 — 사용자 요청 2026-10-27).
 * 위치는 누를 때만 읽고 화면에서만 쓴다
 */
export function NextStopBar({ next, now }: { next: ItineraryItem; now: string }) {
  const { t } = useTranslation();
  const { state, request } = useCurrentPosition(false);
  const [press, setPress] = useState(0);
  const [found, setFound] = useState<Found | null>(null);
  const to = next.place?.coords;
  const google = next.place?.coordsSource === 'google';

  // 누른 뒤 위치를 받으면 그 위치로 한 번만 길을 찾는다
  useEffect(() => {
    if (press === 0 || state.status !== 'ok' || !to) return;
    if (found && found.press === press && found.nextId === next.id) return;
    const here = state.coords;
    let alive = true;
    // 비행기로 건너가야 할 만큼 멀면(다른 나라 등) 묻지 않는다
    // (2026-10-27: 한국에서 일본 샘플을 보면 도보 19909분이 떴음).
    // 다음 일정이 항공편이어도 공항까지는 땅길 — 그대로 찾는다
    const far = distanceKm(here, to) > FAR_LEG_KM;
    const done = (eta: RouteEta | null) =>
      alive && setFound({ nextId: next.id, press, here, eta, far });
    void (far ? Promise.resolve(null) : routeEta(here, to, google, true)).then(done);
    return () => {
      alive = false;
    };
  }, [press, state]); // eslint-disable-line react-hooks/exhaustive-deps -- 누름·위치가 바뀔 때만

  if (!to) return null;
  const search = () => {
    setPress((n) => n + 1);
    request();
  };
  const title = (
    <span className="truncate font-semibold">
      {t('nextStop.title', { time: next.startTime!, title: next.title })}
    </span>
  );
  const current = found && found.nextId === next.id ? found : null;
  // 위치를 못 받으면(거부·시간 초과) 멈추고 다시 누를 수 있게
  const failed = state.status === 'denied' || state.status === 'unavailable';
  const searching = press > 0 && (!current || current.press !== press) && !failed;

  // 아직 안 눌렀거나 다음 일정이 바뀜: 제목 + [이동 시간 검색]
  if (!current)
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 text-micro leading-tight">
        <span className="flex min-w-0 flex-1 flex-col">
          {title}
          {state.status === 'denied' && (
            <span className="truncate text-fg-muted">{t('nextStop.denied')}</span>
          )}
          {press > 0 && state.status === 'unavailable' && (
            <span className="truncate text-fg-muted">{t('nextStop.noFix')}</span>
          )}
        </span>
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-primary/40 px-3 font-semibold text-primary disabled:opacity-60"
        >
          <LocateFixed aria-hidden="true" className="size-3.5" />
          {searching ? t('nextStop.loading') : t('nextStop.search')}
        </button>
      </div>
    );

  const again = (
    <button
      type="button"
      onClick={search}
      disabled={searching}
      aria-label={t('nextStop.again')}
      title={t('nextStop.again')}
      className="grid size-9 shrink-0 place-items-center rounded-full text-fg-muted disabled:opacity-60"
    >
      <RotateCw aria-hidden="true" className={cn('size-4', searching && 'animate-spin')} />
    </button>
  );

  if (current.far)
    return (
      <div
        role="status"
        className="flex min-w-0 flex-1 items-center gap-2 text-micro leading-tight"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          {title}
          <span className="truncate text-fg-muted">{t('nextStop.far')}</span>
        </span>
        {again}
      </div>
    );

  const { eta, here } = current;
  // 길 정보를 못 받았거나(무료량 끝·오프라인) 도보가 빠졌으면(한국은 Google 도보 없음) 직선거리 어림으로 대신
  const roughWalk = walkMinutes(distanceKm(here, to));
  const rough = eta?.walk === undefined;
  // 도보 200분 이상·대중교통 결과 없음은 "검색 불가" (사용자 요청 2026-10-27) — 출발 시각 계산에서도 뺀다
  const walk0 = eta?.walk ?? roughWalk;
  const shown = {
    walk: walk0 < MAX_WALK_MIN ? walk0 : undefined,
    transit: eta?.transit,
  };
  // 검색 불가가 있으면 지도 앱 길찾기로 — 출발지는 넣지 않는다(지도 앱이 현재 위치를 씀)
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${shown.transit === undefined ? 'transit' : 'walking'}`;
  const plan = departurePlan(next.startTime!, now, shown);
  // 왼쪽 2줄(다음 일정 / 시간) + 오른쪽 출발 안내 — 3줄을 넘지 않게 (사용자 요청 2026-10-27)
  return (
    <div role="status" className="flex min-w-0 flex-1 items-center gap-2 text-micro leading-tight">
      <span className="flex min-w-0 flex-1 flex-col">
        {title}
        <span className="truncate text-fg-sub">
          {[
            shown.walk !== undefined
              ? t('nextStop.walkMin', { min: shown.walk }) +
                (rough ? ` ${t('nextStop.roughShort')}` : '')
              : t('nextStop.walkNone'),
            shown.transit !== undefined
              ? t('nextStop.transitMin', { min: shown.transit })
              : t('nextStop.transitNone'),
          ].join(' · ')}
          {(shown.transit === undefined || shown.walk === undefined) && (
            <>
              {' · '}
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {t('nextStop.map')}
              </a>
            </>
          )}
        </span>
      </span>
      {plan.leaveBy && (
        <span
          className={cn(
            'shrink-0 text-right font-semibold whitespace-pre-line',
            plan.leaveNow ? 'text-warning' : 'text-primary',
          )}
        >
          {plan.leaveNow
            ? t('nextStop.leaveNow')
            : t('nextStop.leaveBy', { time: plan.leaveBy, margin: LEAVE_MARGIN_MIN })}
        </span>
      )}
      {again}
    </div>
  );
}
