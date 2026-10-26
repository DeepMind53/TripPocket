import { dayNumberOf, type Trip } from '@trippocket/shared';
import { CalendarDays, ListChecks, Search, Ticket } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useChecklist, useTripBookings, useTripItems } from '../../data/hooks';
import { searchTrip, type TripHit } from '../../domain/tripSearch';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet } from '../../shared/ui';

const ICON = { item: CalendarDays, booking: Ticket, checklist: ListChecks } as const;

/**
 * 실험실 "여행 안 검색" (사용자 요청 2026-10-26): 일정·예약·메모·준비물을 한 번에 찾는다.
 * 기기 DB만 읽어 오프라인에서도 된다. 누르면 그 화면으로 (일정은 그날)
 */
export function TripSearchSheet({
  trip,
  open,
  onOpenChange,
}: {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const items = useTripItems(trip.id) ?? [];
  const bookings = useTripBookings(trip.id) ?? [];
  const packing = useChecklist(trip.id, 'packing') ?? [];
  const todo = useChecklist(trip.id, 'todo') ?? [];
  const hits = searchTrip(q, { items, bookings, checklist: [...packing, ...todo] });
  const base = `/trips/${trip.id}`;

  // 시트 기록 자리를 그 화면으로 바꾼다 (닫고 이동하면 뒤로 가기와 겹친다) — 뒤로 가면 원래 화면
  function go(hit: TripHit) {
    if (hit.kind === 'booking') return void navigate(`${base}/bookings`, { replace: true });
    if (hit.kind === 'checklist') return void navigate(`${base}/checklist`, { replace: true });
    const day = hit.date ? dayNumberOf(trip.startDate, trip.endDate, hit.date) : null;
    void navigate(`${base}/plan?day=${day ?? 'wish'}`, { replace: true });
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('tripSearch.title')}>
      <div className="flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-btn border border-line bg-surface px-3">
          <Search aria-hidden="true" className="size-4 text-fg-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('tripSearch.placeholder')}
            aria-label={t('tripSearch.title')}
            className="min-w-0 flex-1 bg-transparent text-body-2 outline-none"
            autoFocus
          />
        </label>
        {q.trim() && hits.length === 0 && (
          <p className="py-4 text-center text-body-2 text-fg-muted">{t('tripSearch.empty')}</p>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {hits.map((h) => {
            const Icon = ICON[h.kind];
            return (
              <li key={`${h.kind}-${h.id}`}>
                <button
                  type="button"
                  onClick={() => go(h)}
                  className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-2 font-medium">{h.title}</span>
                    {h.matched && (
                      <span className="truncate text-caption text-fg-muted">{h.matched}</span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-caption text-fg-sub">
                    {h.date ? formatMonthDay(h.date) : t(`tripSearch.kind.${h.kind}`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </BottomSheet>
  );
}
