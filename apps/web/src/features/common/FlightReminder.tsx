import { getTripStatus, todayIn } from '@trippocket/shared';
import { useEffect } from 'react';
import { useFlightChecks } from '../../data/flightCheckStore';
import { useTrips, useTripsData } from '../../data/hooks';
import { flightsToReconfirm } from '../../domain/flightCheck';
import { useTranslation } from '../../i18n';
import { useToastStore } from '../../shared/ui/toastStore';

/** 오늘 이미 알렸음 (이 기기) */
const KEY = 'tp-flight-notice';

/**
 * 출발 전날~출발 날 앱을 열면 항공편 재확인 안내를 하루 한 번 (사용자 요청 2026-10-26).
 * 일정 화면의 그 항공편 위 [확인]을 누르면 그 항공편은 다시 알리지 않는다
 */
export function FlightReminder() {
  const { t } = useTranslation();
  const trips = (useTrips() ?? []).filter(
    (tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) !== 'past',
  );
  const data = useTripsData(trips.map((tr) => tr.id));
  const checks = useFlightChecks();

  const due = data
    ? trips.flatMap((tr) =>
        flightsToReconfirm(
          data.bookings.filter((b) => b.tripId === tr.id),
          todayIn(tr.timezone),
          checks,
        ),
      )
    : [];
  const first = due[0];

  useEffect(() => {
    if (!first) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
    } catch {
      // 기록 못 하면 이번 실행에서만 한 번
    }
    useToastStore.getState().show({
      message: `${t('flightCheck.title', { title: first.title })}\n${t('flightCheck.notice')}`,
      duration: 10_000,
    });
  }, [first, t]);

  return null;
}
