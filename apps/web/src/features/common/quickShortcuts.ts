import {
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
  Languages,
  ListChecks,
  MapPinned,
  Printer,
  Settings,
  Siren,
  Sparkles,
  SquarePen,
  Ticket,
  TicketCheck,
  Trash2,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { create } from 'zustand';

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
  'emergency',
  // 여행 화면
  'plan',
  'bookings',
  'checklist',
  'essentials',
  'weather',
  'places',
  'tripSettings',
  'print',
  // 앱 화면
  'ai',
  'fx',
  'phrases',
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

export const DEFAULT_SHORTCUTS: ShortcutId[] = ['lodging', 'bookingNo', 'nextItem', 'checklist'];
export const SHORTCUT_SLOTS = 4;

export const SHORTCUT_ICON: Record<ShortcutId, LucideIcon> = {
  lodging: Bed,
  bookingNo: Ticket,
  nextItem: CalendarClock,
  car: Car,
  emergency: Siren,
  plan: CalendarDays,
  bookings: TicketCheck,
  checklist: ListChecks,
  essentials: IdCard,
  weather: CloudSun,
  places: MapPinned,
  tripSettings: Wrench,
  print: Printer,
  ai: Sparkles,
  fx: Wallet,
  phrases: Languages,
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
  const q = tripId ? `?trip=${tripId}` : '';
  const paths: Partial<Record<ShortcutId, string>> = {
    plan: `${trip}/plan`,
    bookings: `${trip}/bookings`,
    checklist: `${trip}/checklist`,
    essentials: `${trip}/essentials`,
    weather: `${trip}/weather`,
    places: `${trip}/places`,
    tripSettings: `${trip}/settings`,
    print: `${trip}/print`,
    ai: `/ai${q}`,
    fx: `/fx${q}`,
    phrases: `/phrases${q}`,
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
