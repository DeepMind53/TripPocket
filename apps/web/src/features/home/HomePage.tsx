import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { QuickMenuButton } from '../quick-menu/QuickMenu';
import { Button, EmptyState, TopBar } from '../../shared/ui';

/** S-01 홈 — 8단계에서 "여행 중 / 다가오는 여행" 카드가 들어온다 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <TopBar title={t('app.name')} actions={<QuickMenuButton />} />
      <EmptyState
        emoji="🧳"
        title={t('home.emptyTitle')}
        description={t('home.emptyDesc')}
        action={
          <Button size="lg" onClick={() => void navigate('/trips/new')}>
            {t('home.emptyCta')}
          </Button>
        }
        note={t('common.comingInStep', { step: 8 })}
      />
    </>
  );
}
