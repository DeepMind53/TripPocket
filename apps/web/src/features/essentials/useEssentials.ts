import { todayIn, type Trip } from '@trippocket/shared';
import { useMemo } from 'react';
import { useChecklist, useTripBookings } from '../../data/hooks';
import { usePassportExpiry } from '../../data/passportExpiry';
import { buildEssentials, type EssentialsSummary } from '../../domain/essentials';

/** 여행의 나라별 필수 항목 + 체크 상태 (준비 목록 essentials, 동행과 동기화) */
export function useEssentials(trip: Trip | undefined): EssentialsSummary | null {
  const items = useChecklist(trip?.id, 'essentials');
  const bookings = useTripBookings(trip?.id ?? '');
  const passportExpiry = usePassportExpiry((s) => s.value);
  return useMemo(() => {
    if (!trip || !items || !bookings) return null;
    const checked = new Set(items.filter((i) => i.checked).map((i) => i.text));
    return buildEssentials({
      trip,
      bookings,
      checked,
      passportExpiry,
      today: todayIn(trip.timezone),
    });
  }, [trip, items, bookings, passportExpiry]);
}
