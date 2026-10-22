import { useTranslation } from '../../i18n';
import { QuickMenuButton } from '../common/QuickMenu';
import { EmptyState, TopBar } from '../../shared/ui';

/** S-04 저장한 장소 — 18단계 */
export function SavedPage() {
  const { t } = useTranslation();
  return (
    <>
      <TopBar title={t('saved.title')} actions={<QuickMenuButton />} />
      <EmptyState
        emoji="❤️"
        title={t('saved.emptyTitle')}
        description={t('saved.emptyDesc')}
        note={t('common.comingInStep', { step: 18 })}
      />
    </>
  );
}
