import type { Booking } from '@trippocket/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useParams } from 'react-router';
import { useCanEdit } from '../../data/tripRoles';
import { useTrip, useTripBookings } from '../../data/hooks';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { Button, EmptyState } from '../../shared/ui';
import { BookingCard } from './BookingCard';
import { BookingFormSheet } from './BookingFormSheet';

const GROUPS = [
  { key: 'groupFlight', kinds: ['flight'] },
  { key: 'groupLodging', kinds: ['lodging'] },
  { key: 'groupRestaurant', kinds: ['restaurant'] },
  { key: 'groupTransport', kinds: ['train', 'car'] },
  { key: 'groupTicket', kinds: ['tour', 'ticket'] },
  { key: 'groupOther', kinds: ['other'] },
] as const satisfies ReadonlyArray<{ key: string; kinds: ReadonlyArray<Booking['kind']> }>;

/** S-16 예약: 종류별로 묶어 날짜순 */
export function BookingsPage() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId);
  // 보기 전용으로 공유받은 여행: 추가·수정 없이 보기만 (data/tripRoles.ts)
  const canEdit = useCanEdit(tripId);
  const [formOpen, setFormOpen] = useRouteSheet('booking-form');
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!trip || !bookings) return null;
  const editing = bookings.find((b) => b.id === editingId);

  const openForm = (b?: Booking) => {
    setEditingId(b?.id ?? null);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col">
      {bookings.length === 0 ? (
        <EmptyState
          emoji="🎫"
          title={t('bookings.emptyTitle')}
          description={t('bookings.emptyDesc')}
          {...(canEdit
            ? {
                action: (
                  <Button
                    size="lg"
                    leading={<Plus aria-hidden="true" className="size-5" />}
                    onClick={() => openForm()}
                  >
                    {t('bookings.emptyCta')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="flex flex-col gap-6 px-5 pt-3">
          {canEdit && (
            <Button
              variant="secondary"
              fullWidth
              leading={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => openForm()}
            >
              {t('bookings.add')}
            </Button>
          )}
          {GROUPS.map((g) => {
            const list = bookings.filter((b) => (g.kinds as readonly string[]).includes(b.kind));
            if (list.length === 0) return null;
            return (
              <section
                key={g.key}
                aria-label={t(`bookings.${g.key}`)}
                className="flex flex-col gap-2"
              >
                <h2 className="text-caption font-bold text-fg-muted">{t(`bookings.${g.key}`)}</h2>
                <ul className="flex flex-col gap-2">
                  {list.map((b) => (
                    <BookingCard key={b.id} booking={b} onOpen={() => canEdit && openForm(b)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <BookingFormSheet open={formOpen} onOpenChange={setFormOpen} trip={trip} booking={editing} />
    </div>
  );
}
