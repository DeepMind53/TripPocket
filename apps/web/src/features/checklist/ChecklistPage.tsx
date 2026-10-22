import { useTranslation } from '../../i18n';
import { EmptyState } from '../../shared/ui';

/** S-18 준비 — 9단계 */
export function ChecklistPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      emoji="✅"
      title={t('checklist.emptyTitle')}
      description={t('checklist.emptyDesc')}
      note={t('common.comingInStep', { step: 9 })}
    />
  );
}
