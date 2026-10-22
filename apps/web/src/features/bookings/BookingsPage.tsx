import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../shared/ui';

/** S-16 예약 — 8단계 */
export function BookingsPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      emoji="🎫"
      title={t('bookings.emptyTitle')}
      description={t('bookings.emptyDesc')}
      note={t('common.comingInStep', { step: 8 })}
    />
  );
}
