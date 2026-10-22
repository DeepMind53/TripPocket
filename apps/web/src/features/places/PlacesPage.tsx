import { useTranslation } from '../../i18n';
import { EmptyState } from '../../shared/ui';

/** S-14 장소 찾기 — 18단계 */
export function PlacesPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      emoji="🔍"
      title={t('places.emptyTitle')}
      description={t('places.emptyDesc')}
      note={t('common.comingInStep', { step: 18 })}
    />
  );
}
