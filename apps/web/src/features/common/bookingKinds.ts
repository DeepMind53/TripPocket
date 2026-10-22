import type { Booking } from '@trippocket/shared';
import { BedDouble, Bus, Car, Plane, Ticket, Utensils, type LucideIcon } from 'lucide-react';

/** 예약 종류별 아이콘. 라벨은 i18n `bookingKind.*` */
export const BOOKING_ICON: Record<Booking['kind'], LucideIcon> = {
  flight: Plane,
  lodging: BedDouble,
  restaurant: Utensils,
  train: Bus,
  car: Car,
  tour: Ticket,
  ticket: Ticket,
  other: Ticket,
};
