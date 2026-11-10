import { getTripStatus, todayIn } from '@trippocket/shared';
import { useEffect } from 'react';
import { useTrips } from '../../data/hooks';
import { useLab } from '../../data/labsStore';
import { useSettings } from '../../data/settingsStore';
import { afterDark, sunTimes } from '../../domain/sun';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { applyTheme } from '../../shared/lib/theme';

/**
 * 해 질 녘 자동 다크 (실험실 sunsetDark, 2026-11-10): 여행 중이고 테마가 "시스템"이면
 * 여행지 해가 진 뒤 어둡게, 해가 뜨면 밝게. 좌표는 기기 안에서만 계산 (서버로 보내지 않음), 설정은 바꾸지 않는다
 */
export function SunsetDark() {
  const on = useLab('sunsetDark');
  const theme = useSettings((s) => s.theme);
  const active = on && theme === 'system';
  const now = useMinuteClock(active);
  const trips = useTrips();
  const trip = active
    ? trips?.find(
        (tr) =>
          getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) === 'ongoing' &&
          tr.destinations.some((d) => d.coords),
      )
    : undefined;
  const coords = trip?.destinations.find((d) => d.coords)?.coords;
  const sun = trip && coords ? sunTimes(todayIn(trip.timezone), coords, trip.timezone) : null;
  const local = trip ? timeIn(trip.timezone, now) : null;
  const dark = sun && local ? afterDark(local, sun) : null;

  useEffect(() => {
    if (dark === null) return;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    return () => applyTheme(useSettings.getState().theme);
  }, [dark]);
  return null;
}
