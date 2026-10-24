import { getTripStatus, todayIn, type Trip, type TripStatus, flagEmoji } from '@trippocket/shared';
import { ChevronDown, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate } from 'react-router';
import { useTripItems, useTrips } from '../../data/hooks';
import { useMemberCount, useTripRole } from '../../data/tripRoles';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { formatPeriod, formatTripBadge, formatTripLength } from '../../shared/lib/dateFormat';
import { BottomSheet, Button, EmptyState, IconButton, TopBar } from '../../shared/ui';
import { deleteTripWithUndo } from './tripActions';

/** S-02 내 여행 (전체 목록 — 홈·기록 탭이 나눠 보여 주고, 이 화면은 "모든 여행"으로 남김) */
export function TripsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <TopBar
        title={t('trips.title')}
        backTo="/"
        actions={
          <IconButton
            label={t('trips.new')}
            icon={<Plus />}
            onClick={() => void navigate('/trips/new')}
          />
        }
      />
      <TripList only="all" />
    </>
  );
}

/**
 * 여행 목록: only = active(여행 중·다가오는 — 홈) / past(다녀온 — 기록 탭) / all.
 * 카드 ⋯ → 삭제(실행 취소)
 */
export function TripList({
  only,
  exclude,
}: {
  only: 'active' | 'past' | 'all';
  /** 홈 위쪽 큰 카드로 이미 보여 준 여행 */
  exclude?: string | undefined;
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

  async function remove(trip: Trip) {
    setMenuOpen(false);
    await deleteTripWithUndo(trip);
  }

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
          emoji="🗺️"
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
            <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-caption font-bold text-fg-muted">
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

      <BottomSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={menuTrip?.title ?? t('trips.menuTitle')}
      >
        {menuTrip && (
          <Button
            variant="secondary"
            fullWidth
            className="justify-start text-danger"
            leading={<Trash2 aria-hidden="true" className="size-[18px]" />}
            onClick={() => void remove(menuTrip)}
          >
            {t('trips.delete')}
          </Button>
        )}
      </BottomSheet>
    </>
  );
}

function TripSection({
  title,
  trips,
  onMenu,
}: {
  title: string;
  trips: Trip[];
  onMenu: (trip: Trip) => void;
}) {
  if (trips.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-caption font-bold text-fg-muted">{title}</h2>
      <ul className="flex flex-col gap-2">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} onMenu={onMenu} />
        ))}
      </ul>
    </section>
  );
}

function TripCard({ trip, onMenu }: { trip: Trip; onMenu: (trip: Trip) => void }) {
  const { t } = useTranslation();
  const today = todayIn(trip.timezone);
  const isPast = getTripStatus(trip.startDate, trip.endDate, today) === 'past';
  const items = useTripItems(trip.id);
  const members = useMemberCount(trip.id);
  const role = useTripRole(trip.id);
  // 나라 국기 (중복 없이)
  const flags = [
    ...new Set(trip.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))),
  ]
    .map(flagEmoji)
    .join('');
  return (
    <li className="flex items-center gap-1 rounded-card border border-line bg-surface pr-1 shadow-card">
      <Link to={`/trips/${trip.id}/plan`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-btn text-[28px]"
          style={{ background: `${trip.cover.color ?? '#2F6BFF'}22` }}
        >
          {trip.cover.emoji ?? '🧳'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-1">{trip.title}</span>
          <span className="tabular truncate text-caption text-fg-muted">
            {flags && `${flags} `}
            {formatPeriod(trip.startDate, trip.endDate)} ·{' '}
            {formatTripLength(trip.startDate, trip.endDate)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`tabular rounded-full px-2 py-0.5 text-micro ${isPast ? 'bg-bg-subtle text-fg-muted' : 'bg-primary-weak text-primary'}`}
            >
              {formatTripBadge(trip.startDate, trip.endDate, today)}
            </span>
            {/* 일정 수 · 함께 쓰는 사람 (docs/16 E1) */}
            {items !== undefined && (
              <span className="tabular text-micro text-fg-muted">
                {t('trips.itemCount', { n: items.length })}
              </span>
            )}
            {members > 1 && (
              <span className="tabular text-micro text-fg-muted">
                👥 {members}
                {role === 'viewer' && ` · ${t('share.role.viewer')}`}
              </span>
            )}
          </span>
        </span>
      </Link>
      <IconButton
        label={t('trips.openMenu', { title: trip.title })}
        icon={<Ellipsis />}
        onClick={() => onMenu(trip)}
      />
    </li>
  );
}
