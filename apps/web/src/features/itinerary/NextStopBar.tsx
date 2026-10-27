import { distanceKm, walkMinutes, type ItineraryItem, type RouteEta } from '@trippocket/shared';
import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { routeEta } from '../../data/api/routes';
import { LEAVE_MARGIN_MIN, departurePlan } from '../../domain/dayTools';
import { useTranslation } from '../../i18n';
import { useCurrentPosition } from '../../shared/hooks/useCurrentPosition';

/**
 * 일정 화면 지도·편집 사이 "다음 일정" 줄 (사용자 요청 2026-10-27): 여행 당일 지금 위치에서
 * 다음 일정까지 실제 걷는 길·대중교통 시간과 각각 몇 시에 나가면 되는지, 늦을 것 같으면 알림.
 * 위치를 아직 허락하지 않았으면 버튼 하나 — 누르면 묻고 계산한다. 위치는 화면에서만 쓴다
 */
export function NextStopBar({ next, now }: { next: ItineraryItem; now: string }) {
  const { t } = useTranslation();
  const { state, request } = useCurrentPosition(true);
  const [result, setResult] = useState<{ key: string; eta: RouteEta | null } | null>(null);
  const to = next.place?.coords;
  const google = next.place?.coordsSource === 'google';
  const here = state.status === 'ok' ? state.coords : undefined;
  // 위치가 100m 넘게 바뀌었을 때만 다시 묻는다 (routeEta도 100m로 줄여 보낸다)
  const key =
    here && to
      ? `${Math.round(here.lat * 1000)},${Math.round(here.lng * 1000)}>${to.lat},${to.lng},${google}`
      : '';

  useEffect(() => {
    if (!key || !here || !to) return;
    let alive = true;
    void routeEta(here, to, google, true).then((eta) => alive && setResult({ key, eta }));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key에 here·to·google이 담겨 있다

  // 지금 위치에 맞는 결과가 올 때까지는 "길 찾는 중"
  const eta = result && result.key === key ? result.eta : undefined;

  if (!to) return null;
  if (state.status !== 'ok')
    return (
      <button
        type="button"
        onClick={request}
        disabled={state.status === 'asking'}
        className="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-primary/40 px-2 text-micro font-semibold text-primary disabled:opacity-60"
      >
        <LocateFixed aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">
          {state.status === 'denied' ? t('nextStop.denied') : t('nextStop.ask')}
        </span>
      </button>
    );

  // 길 정보를 못 받으면(무료량 끝·오프라인) 직선거리로 어림한 걷는 시간으로 대신 (대체 기능)
  const rough: { walk: number; transit?: number } | undefined =
    eta === null && here ? { walk: walkMinutes(distanceKm(here, to)) } : undefined;
  const shown = eta ?? rough;
  const plan = departurePlan(next.startTime!, now, shown ?? {});
  return (
    <div role="status" className="flex min-w-0 flex-1 flex-col text-micro leading-tight">
      <span className="truncate font-semibold">
        {t('nextStop.title', { time: next.startTime!, title: next.title })}
      </span>
      {shown === undefined ? (
        <span className="text-fg-muted">{t('nextStop.loading')}</span>
      ) : (
        <>
          {/* 2줄: 도보 nn분 · 대중교통 mm분 (사용자 요청 2026-10-27 — 짧게) */}
          <span className="truncate text-fg-sub">
            {[
              shown.walk !== undefined ? t('nextStop.walkMin', { min: shown.walk }) : null,
              shown.transit !== undefined ? t('nextStop.transitMin', { min: shown.transit }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {rough ? ` ${t('nextStop.roughShort')}` : ''}
          </span>
          {/* 3줄: 여유를 두고 몇 시까지 나가야 하는지 */}
          {plan.leaveBy && (
            <span
              className={
                plan.leaveNow ? 'font-semibold text-warning' : 'font-semibold text-primary'
              }
            >
              {plan.leaveNow
                ? t('nextStop.leaveNow')
                : t('nextStop.leaveBy', { time: plan.leaveBy, margin: LEAVE_MARGIN_MIN })}
            </span>
          )}
        </>
      )}
    </div>
  );
}
