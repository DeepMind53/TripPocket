import { todayIn, type Trip } from '@trippocket/shared';
import { useEffect } from 'react';
import { Navigate } from 'react-router';
import { useLab } from '../../data/labsStore';
import { declineTravelMode, setTravelMode, useTravelMode } from '../../data/travelModeStore';
import { useTranslation } from '../../i18n';
import { Button } from '../../shared/ui';
import { toast } from '../../shared/ui/toastStore';

/**
 * 여행 모드 입구 (실험실, 2026-11-03 추천안): 일정 화면 위에서
 * - 여행 중 처음 열면 한 번 묻기 (D2) — [시작]/[괜찮아요]
 * - 켜 두었으면 여행 모드 화면으로 (D1 이 기기만)
 * - 돌아온 다음 날부터는 저절로 끄고 기록(회고)을 권한다 (D6)
 */
export function TravelModeGate({ trip }: { trip: Trip }) {
  const lab = useLab('travelMode');
  const on = useTravelMode((s) => s.on[trip.id] === true);
  const asked = useTravelMode((s) => s.asked[trip.id] === true);
  const { t } = useTranslation();
  const today = todayIn(trip.timezone);
  const during = today >= trip.startDate && today <= trip.endDate;
  const ended = today > trip.endDate;

  useEffect(() => {
    if (!lab || !on || !ended) return;
    setTravelMode(trip.id, false);
    toast(t('travel.ended'));
  }, [lab, on, ended, trip.id, t]);

  if (!lab || !during) return null;
  if (on) return <Navigate to={`/trips/${trip.id}/go`} replace />;
  if (asked) return null;
  return (
    <div
      role="region"
      aria-label={t('travel.askTitle')}
      className="mx-5 mt-2 flex flex-col gap-2 rounded-card border border-primary/40 bg-primary-weak/40 p-4"
    >
      <span className="text-body-1 font-bold">{t('travel.askTitle')}</span>
      <span className="text-caption whitespace-pre-line text-fg-sub">{t('travel.askDesc')}</span>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setTravelMode(trip.id, true)}>
          {t('travel.start')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => declineTravelMode(trip.id)}>
          {t('travel.decline')}
        </Button>
      </div>
    </div>
  );
}
