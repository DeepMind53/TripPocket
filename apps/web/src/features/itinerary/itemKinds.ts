import type { ItemKind } from '@trippocket/shared';
import {
  BedDouble,
  Coffee,
  Landmark,
  ShoppingBag,
  StickyNote,
  Ticket,
  TrainFront,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

/** 일정 종류별 아이콘 (docs/11 §3.4). 라벨은 i18n `kind.*` */
export const KIND_ICON: Record<ItemKind, LucideIcon> = {
  place: Landmark,
  food: Utensils,
  cafe: Coffee,
  shopping: ShoppingBag,
  transport: TrainFront,
  lodging: BedDouble,
  activity: Ticket,
  note: StickyNote,
};

/** 일차 색 (8색 순환, docs/11 §3.3) */
export function dayColor(dayIndex: number): string {
  return `var(--tp-day-${(dayIndex % 8) + 1})`;
}
