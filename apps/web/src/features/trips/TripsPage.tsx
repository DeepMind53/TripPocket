import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from '../../i18n';
import { IconButton, TopBar } from '../../shared/ui';
import { TripList } from './TripList';

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
