import { hotelKeyFor, nightsBetween } from '@trippocket/shared';
import type { ReportQuery } from '../../data/api/lodging';
import type { AgodaBase } from '../../domain/agodaRoutes';
import type { StayQuery } from '../../domain/lodgingLinks';

/** 기록을 묶는 숙소 열쇠: 아고다 번호를 알면 그것 + 이름 열쇠도 함께 본다 (docs/28 §5) */
export function reportQueryOf(q: StayQuery, agoda: AgodaBase | null): ReportQuery {
  const hid = agoda && 'hid' in agoda ? agoda.hid : undefined;
  const nameKey = hotelKeyFor(q.name);
  return {
    hotelKey: hid ? hotelKeyFor(q.name, undefined, hid) : nameKey,
    altKey: hid ? nameKey : undefined,
    checkIn: q.checkIn,
    nights: nightsBetween(q.checkIn, q.checkOut),
    adults: q.adults,
  };
}
