import { InlineIcon } from '../../shared/ui/InlineIcon';
import {
  dayNumberOf,
  getTripStatus,
  todayIn,
  type Trip,
  type TripStatus,
} from '@trippocket/shared';
import { ChevronDown, CloudSun, Ellipsis, Trash2, Users, Map as MapIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate } from 'react-router';
import { useTripItems, useTrips } from '../../data/hooks';
import { useMemberCount, useTripRole } from '../../data/tripRoles';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { formatPeriod, formatTripBadge, formatTripLength } from '../../shared/lib/dateFormat';
import { cn } from '../../shared/lib/cn';
import {
  BottomSheet,
  Button,
  EmptyState,
  IconButton,
  RollingSlot,
  RouteBar,
} from '../../shared/ui';
import { deleteTripWithUndo } from './tripActions';

/**
 * 여행 목록: only = active(여행 중·다가오는 — 홈) / past(다녀온 — 기록 탭) / all.
 * 카드 ⋯ → 삭제(실행 취소)
 */
export function TripList({
  only,
  exclude,
  renderOngoing,
}: {
  only: 'active' | 'past' | 'all';
  /** 홈 위쪽 큰 카드로 이미 보여 준 여행 */
  exclude?: string | undefined;
  /** 홈: 여행 중인 여행은 카드 대신 오늘 일정 묶음으로 (사용자 요청 2026-11-06) */
  renderOngoing?: ((trip: Trip) => ReactNode) | undefined;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const trips = useTrips();
  const [menuOpen, setMenuOpen] = useRouteSheet('trip-menu');
  const [menuTrip, setMenuTrip] = useState<Trip | null>(null);

  const groups: Record<TripStatus, Trip[]> = { ongoing: [], upcoming: [], past: [] };
  for (const trip of (trips ?? []).filter((x) => x.id !== exclude)) {
    groups[getTripStatus(trip.startDate, trip.endDate, todayIn(trip.timezone))].push(trip);
  }
  // 다녀온 여행은 최근 것이 위로
  groups.past.reverse();

  const openMenu = (trip: Trip) => {
    setMenuTrip(trip);
    setMenuOpen(true);
  };

  const showActive = only !== 'past';
  const showPast = only !== 'active';
  return (
    <>
      {showActive && trips?.length === 0 && (
        <EmptyState
          icon={MapIcon}
          title={t('trips.emptyTitle')}
          description={t('trips.emptyDesc')}
          action={
            <Button size="lg" onClick={() => void navigate('/trips/new')}>
              {t('trips.emptyCta')}
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-6 px-5 pt-2">
        {showActive && (
          <>
            <TripSection
              title={t('trips.sectionOngoing')}
              trips={groups.ongoing}
              onMenu={openMenu}
              render={renderOngoing}
            />
            <TripSection
              title={t('trips.sectionUpcoming')}
              trips={groups.upcoming}
              onMenu={openMenu}
            />
          </>
        )}
        {only === 'past' && (
          <ul className="flex flex-col gap-2">
            {groups.past.map((trip) => (
              <TripCard key={trip.id} trip={trip} onMenu={openMenu} />
            ))}
          </ul>
        )}
        {only === 'all' && showPast && groups.past.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-caption font-medium text-fg-muted">
              {t('trips.sectionPast')} {groups.past.length}
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {groups.past.map((trip) => (
                <TripCard key={trip.id} trip={trip} onMenu={openMenu} />
              ))}
            </ul>
          </details>
        )}
      </div>

      <TripMenuSheet trip={menuTrip} open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}

function TripSection({
  title,
  trips,
  onMenu,
  render,
}: {
  title: string;
  trips: Trip[];
  onMenu: (trip: Trip) => void;
  render?: ((trip: Trip) => ReactNode) | undefined;
}) {
  if (trips.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-caption font-medium text-fg-muted">{title}</h2>
      <ul className="flex flex-col gap-2">
        {trips.map((trip) =>
          render ? (
            <li key={trip.id} className="flex flex-col gap-4">
              {render(trip)}
            </li>
          ) : (
            <TripCard key={trip.id} trip={trip} onMenu={onMenu} />
          ),
        )}
      </ul>
    </section>
  );
}

/** "HH:mm" → 하루 중 지난 분 (없으면 0) */
const minutesOf = (hm: string | null) =>
  hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : 0;

/** 여행 ⋯ 메뉴 (삭제 → 실행 취소). 목록과 홈 맨 위 카드가 같이 쓴다 */
export function TripMenuSheet({
  trip,
  open,
  onOpenChange,
}: {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={trip?.title ?? t('trips.menuTitle')}
    >
      {trip && (
        <Button
          variant="dangerSoft"
          fullWidth
          className="justify-start"
          leading={<Trash2 aria-hidden="true" className="size-[18px]" />}
          onClick={() => {
            onOpenChange(false);
            void deleteTripWithUndo(trip);
          }}
        >
          {t('trips.delete')}
        </Button>
      )}
    </BottomSheet>
  );
}

/**
 * 여행 카드: [D-day] 제목 👥n / 국기 날짜 ↔ N박 M일 / 현지시간 · 일정 수 / 노선 막대 + 날씨 · ⋯ (사용자 요청 2026-11-23:
 * D-day는 제목 앞, 함께 쓰는 사람은 제목 오른쪽, 잘리던 날짜 줄은 전광판).
 * onColor = 홈 맨 위 카드: 같은 모양에 표지 색 바탕(여행 중이면 민트) + 흰 글자
 */
export function TripCard({
  trip,
  onMenu,
  onColor = false,
  as: Tag = 'li',
}: {
  trip: Trip;
  onMenu: (trip: Trip) => void;
  onColor?: boolean;
  as?: 'li' | 'div';
}) {
  const { t } = useTranslation();
  const today = todayIn(trip.timezone);
  const status = getTripStatus(trip.startDate, trip.endDate, today);
  const isPast = status === 'past';
  const total = dayNumberOf(trip.startDate, trip.endDate, trip.endDate) ?? 1;
  const dayNow = dayNumberOf(trip.startDate, trip.endDate, today);
  const now = useMinuteClock(!isPast);
  const localNow = isPast ? null : timeIn(trip.timezone, now);
  const items = useTripItems(trip.id);
  const members = useMemberCount(trip.id);
  const role = useTripRole(trip.id);
  const badge = formatTripBadge(trip.startDate, trip.endDate, today);
  const sub = onColor ? 'text-white/85' : 'text-fg-muted';
  return (
    <Tag
      className={cn(
        'flex items-center gap-1 rounded-card pr-1 shadow-card',
        onColor ? 'text-white' : 'border border-line bg-surface',
        onColor && status === 'ongoing' && 'bg-mint',
      )}
      // 여행 중이면 민트(사용자 요청 2026-11-06), 아니면 여행 표지 색
      style={
        onColor && status !== 'ongoing'
          ? {
              background: `color-mix(in srgb, ${trip.cover.color ?? '#2F6BFF'} var(--tp-cover-mix), black)`,
            }
          : undefined
      }
    >
      <Link to={`/trips/${trip.id}/plan`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-btn text-[28px] tight:size-11 tight:text-[22px]',
            onColor && 'bg-white/20',
          )}
          style={onColor ? undefined : { background: `${trip.cover.color ?? '#2F6BFF'}22` }}
        >
          {trip.cover.emoji ?? '🧳'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* [D-day] 제목 👥 — D-day는 따로 칸이라 제목이 두 줄이 돼도 둘째 줄이 제목 첫 글자 아래에서 시작한다.
              D-day·인원은 제목 첫 줄 가운데 높이에 맞춘다 (사용자 요청 2026-11-23: 위아래 정렬) */}
          <span className="flex min-w-0 items-start gap-1.5">
            <span
              className={cn(
                'tabular mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-micro',
                onColor
                  ? 'bg-white/20 text-white'
                  : isPast
                    ? 'bg-bg-subtle text-fg-muted'
                    : 'bg-primary-weak text-primary',
              )}
            >
              {badge}
            </span>
            <span className="line-clamp-2 min-w-0 text-body-1">{trip.title}</span>
            {/* 함께 쓰는 사람 (docs/16 E1) — 제목 오른쪽 */}
            {members > 1 && (
              <span
                className={cn('tabular mt-1 flex shrink-0 items-center gap-0.5 text-micro', sub)}
              >
                <InlineIcon icon={Users} className={sub} />
                {members}
                {role === 'viewer' && ` · ${t('share.role.viewer')}`}
              </span>
            )}
          </span>
          {/* 날짜 ↔ N박 M일 전광판: 좁은 카드에서 잘리지 않게. 작은 국기는 빼고 올해면 연도 생략 (docs/31 N2) */}
          <span className={cn('flex min-w-0 items-center gap-1 text-caption', sub)}>
            {/* 칸보다 넓으면 옆(날씨 버튼)으로 넘치지 않게 자른다 */}
            <span className="min-w-0 overflow-hidden">
              <RollingSlot
                reserve
                align="start"
                className="tabular whitespace-nowrap"
                items={[
                  <span key="period">
                    {formatPeriod(trip.startDate, trip.endDate, today.slice(0, 4))}
                  </span>,
                  <span key="length">{formatTripLength(trip.startDate, trip.endDate)}</span>,
                ]}
              />
            </span>
          </span>
          {(localNow || items !== undefined) && (
            <span
              className={cn(
                'tabular flex items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-micro',
                sub,
              )}
            >
              {/* 여행지 지금 시각 (사용자 요청 2026-10-25) */}
              {localNow && <span>{t('trips.localNow', { time: localNow })}</span>}
              {items !== undefined && <span>{t('trips.itemCount', { n: items.length })}</span>}
            </span>
          )}
          {/* 노선 막대 (docs/29 §7.2, 사용자 결정 Q7): 일차 수만큼 노선 색 칸, 오늘 칸 위 점, 지난 날 흐림.
              배지 글자와 같은 정보라 스크린리더에는 숨긴다 */}
          <span aria-hidden="true" className="mt-1.5 block">
            <RouteBar
              days={total}
              todayIndex={dayNow === null ? null : dayNow - 1}
              pastBefore={isPast ? total : dayNow === null ? 0 : dayNow - 1}
              label={badge}
              onColor={onColor}
              progress={
                isPast
                  ? 1
                  : status === 'ongoing' && dayNow !== null
                    ? (dayNow - 1 + minutesOf(localNow) / 1440) / total
                    : 0
              }
            />
          </span>
        </span>
      </Link>
      {/* 날씨·⋯는 세로로 쌓아 글자 칸을 넓힌다 (2026-11-23 — 가로로 두면 320px에서 글자 칸이 84px) */}
      <span className="flex shrink-0 flex-col items-center">
        {/* 여행마다 날씨 정보 바로가기 (사용자 요청 2026-10-27) — 끝난 여행은 빼고 */}
        {!isPast && (
          <Link
            to={`/trips/${trip.id}/weather`}
            aria-label={t('trips.weatherOf', { title: trip.title })}
            className={cn(
              'flex size-11 shrink-0 flex-col items-center justify-center rounded-btn',
              onColor ? 'text-white active:bg-white/15' : 'text-fg-sub active:bg-bg-subtle',
            )}
          >
            <CloudSun aria-hidden="true" className={cn('size-5', !onColor && 'text-primary')} />
            <span className="text-micro">{t('trips.weather')}</span>
          </Link>
        )}
        <IconButton
          label={t('trips.openMenu', { title: trip.title })}
          icon={<Ellipsis />}
          tone={onColor ? 'onColor' : 'plain'}
          onClick={() => onMenu(trip)}
        />
      </span>
    </Tag>
  );
}
