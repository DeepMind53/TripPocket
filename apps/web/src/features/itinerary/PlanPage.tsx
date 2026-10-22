import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../shared/ui';

/** S-10 일정 — 6단계 목록, 17단계 지도 */
export function PlanPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      emoji="📅"
      title={t('plan.emptyTitle')}
      description={t('plan.emptyDesc')}
      note={t('common.comingInStep', { step: 6 })}
    />
  );
}
