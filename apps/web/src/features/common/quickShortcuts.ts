import {
  BadgePercent,
  Bed,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Car,
  CircleHelp,
  CloudSun,
  DatabaseBackup,
  FlaskConical,
  Heart,
  IdCard,
  ListChecks,
  MapPinned,
  Printer,
  Settings,
  SquarePen,
  Ticket,
  TicketCheck,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { create } from 'zustand';
import type { LabId } from '../../data/labsStore';

/**
 * 빠른 메뉴 바로가기 (사용자 요청 2026-11-02): 4칸을 사용자가 고른다. 이동 가능한 화면과 빠른 메뉴 기능 모두.
 * 고른 것은 이 기기에만 저장 (기기마다 손에 익은 것이 다를 수 있어서)
 */
export const SHORTCUT_IDS = [
  // 빠른 메뉴 기능
  'lodging',
  'bookingNo',
  'nextItem',
  'car',
  // 여행 화면
  'plan',
  'bookings',
  'checklist',
  'essentials',
  'weather',
  'places',
  'tripSettings',
  'print',
  // 실험실 "숙소 최저가"를 켰을 때만 고를 수 있다 (docs/28 Q5)
  'lodgingPrice',
  // 앱 화면 (긴급 연락처·환율·AI 추천·번역·회화는 빠른 메뉴 맨 위에 늘 있어 뺐다, 2026-11-04)
  'saved',
  'records',
  'profile',
  'reviews',
  'trash',
  'backup',
  'settings',
  'labs',
  'help',
] as const;
export type ShortcutId = (typeof SHORTCUT_IDS)[number];

/** 실험실 기능 바로가기: 그 실험을 켰을 때만 고르고 보인다 */
export const SHORTCUT_LAB: Partial<Record<ShortcutId, LabId>> = { lodgingPrice: 'lodgingPrice' };

export const DEFAULT_SHORTCUTS: ShortcutId[] = ['lodging', 'bookingNo', 'nextItem', 'checklist'];
export const SHORTCUT_SLOTS = 4;

export const SHORTCUT_ICON: Record<ShortcutId, LucideIcon> = {
  lodging: Bed,
  bookingNo: Ticket,
  nextItem: CalendarClock,
  car: Car,
  plan: CalendarDays,
  bookings: TicketCheck,
  checklist: ListChecks,
  essentials: IdCard,
  weather: CloudSun,
  places: MapPinned,
  tripSettings: Wrench,
  print: Printer,
  lodgingPrice: BadgePercent,
  saved: Heart,
  records: BookOpen,
  profile: IdCard,
  reviews: SquarePen,
  trash: Trash2,
  backup: DatabaseBackup,
  settings: Settings,
  labs: FlaskConical,
  help: CircleHelp,
};

/** 화면으로 가는 바로가기의 주소 (tripId가 필요한 것은 여행 안에서만) */
export function shortcutPath(id: ShortcutId, tripId: string): string | null {
  const trip = `/trips/${tripId}`;
  const paths: Partial<Record<ShortcutId, string>> = {
    plan: `${trip}/plan`,
    bookings: `${trip}/bookings`,
    checklist: `${trip}/checklist`,
    essentials: `${trip}/essentials`,
    weather: `${trip}/weather`,
    places: `${trip}/places`,
    tripSettings: `${trip}/settings`,
    print: `${trip}/print`,
    lodgingPrice: `/lodging-price?trip=${tripId}`,
    saved: '/saved',
    records: '/records',
    profile: '/me/profile',
    reviews: '/me/reviews',
    trash: '/me/trash',
    backup: '/backup',
    settings: '/settings',
    labs: '/labs',
    help: '/help',
  };
  return paths[id] ?? null;
}

const KEY = 'tp-quick-shortcuts';
function load(): ShortcutId[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (Array.isArray(v)) {
      const ids = v.filter((x): x is ShortcutId =>
        (SHORTCUT_IDS as readonly unknown[]).includes(x),
      );
      if (ids.length > 0) return [...new Set(ids)].slice(0, SHORTCUT_SLOTS);
    }
  } catch {
    // 기본값
  }
  return DEFAULT_SHORTCUTS;
}

export const useQuickShortcuts = create<{ ids: ShortcutId[] }>(() => ({ ids: load() }));

export function setQuickShortcuts(ids: ShortcutId[]): void {
  const next = [...new Set(ids)].slice(0, SHORTCUT_SLOTS);
  useQuickShortcuts.setState({ ids: next });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 이번 실행에서는 적용
  }
}
