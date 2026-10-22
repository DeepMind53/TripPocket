import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { QuickMenuButton } from '../quick-menu/QuickMenu';
import { Button, EmptyState, TopBar, toast } from '../../shared/ui';

/** S-02 내 여행 — 5단계에서 여행 목록·만들기가 들어온다 */
export function TripsPage() {
  const { t } = useTranslation();
  return (
    <>
      <TopBar title={t('trips.title')} actions={<QuickMenuButton />} />
      <EmptyState
        emoji="🗺️"
        title={t('trips.emptyTitle')}
        description={t('trips.emptyDesc')}
        action={
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" onClick={() => toast(t('common.comingInStep', { step: 5 }))}>
              {t('trips.emptyCta')}
            </Button>
            <Link
              to="/trips/demo/plan"
              className="px-3 py-2 text-body-2 font-semibold text-primary"
            >
              {t('trips.demo')}
            </Link>
          </div>
        }
        note={t('common.comingInStep', { step: 5 })}
      />
    </>
  );
}
