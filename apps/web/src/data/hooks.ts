import type { SavedPlace } from '@trippocket/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  Booking,
  ChecklistItem,
  ChecklistTemplate,
  ItineraryItem,
  Trip,
} from '@trippocket/shared';
import { bookingRepo } from './repositories/bookingRepo';
import { checklistRepo, type ListKind, type PrepList } from './repositories/checklistRepo';
import { templateRepo } from './repositories/templateRepo';
import { itemRepo } from './repositories/itemRepo';
import { settingsRepo } from './repositories/settingsRepo';
import { tripRepo } from './repositories/tripRepo';
import { savedPlaceRepo } from './repositories/savedPlaceRepo';
import { trashRepo, type TrashEntry } from './repositories/trashRepo';

// 저장소가 바뀌면 화면이 자동으로 다시 그려진다. 불러오는 중에는 undefined.

export function useTrips(): Trip[] | undefined {
  return useLiveQuery(() => tripRepo.listActive(), []);
}

/** 없는 여행이면 null, 불러오는 중이면 undefined */
export function useTrip(id: string | undefined): Trip | null | undefined {
  return useLiveQuery(async () => (id ? ((await tripRepo.get(id)) ?? null) : null), [id]);
}

export function useTripItems(tripId: string | undefined): ItineraryItem[] | undefined {
  return useLiveQuery(async () => (tripId ? itemRepo.listByTrip(tripId) : []), [tripId]);
}

/** 설정 값 하나 (불러오는 중에는 fallback) */
export function useSetting<T>(key: string, fallback: T): T {
  return useLiveQuery(() => settingsRepo.get(key, fallback), [key]) ?? fallback;
}

/**
 * 여러 여행의 일정·예약 (기록 탭 회고). 불러오는 중에는 undefined.
 * 여행 목록이 바뀐 직후에는 예전 결과가 잠깐 남으므로, 지금 목록의 결과일 때만 돌려준다
 */
export function useTripsData(
  tripIds: readonly string[],
): { items: ItineraryItem[]; bookings: Booking[] } | undefined {
  const key = tripIds.join(',');
  const data = useLiveQuery(async () => {
    const [items, bookings] = await Promise.all([
      itemRepo.listByTrips(tripIds),
      bookingRepo.listByTrips(tripIds),
    ]);
    return { key, items, bookings };
  }, [key]);
  return data?.key === key ? data : undefined;
}

/** 삭제 기록 복원 목록 (마이 → 삭제 기록 복원) */
export function useTrash(): TrashEntry[] | undefined {
  return useLiveQuery(() => trashRepo.list(), []);
}

/** 방문 기록을 남긴 일정 (기록 탭) */
export function useVisitedItems(): ItineraryItem[] | undefined {
  return useLiveQuery(() => itemRepo.listVisited(), []);
}

export function useTripBookings(tripId: string | undefined): Booking[] | undefined {
  return useLiveQuery(async () => (tripId ? bookingRepo.listByTrip(tripId) : []), [tripId]);
}

export function useChecklist(
  tripId: string | undefined,
  list: ListKind,
): ChecklistItem[] | undefined {
  return useLiveQuery(async () => (tripId ? checklistRepo.list(tripId, list) : []), [tripId, list]);
}

/** 일행이 공유한 준비물 (2026-10-27) */
export function useSharedPacking(tripId: string | undefined): ChecklistItem[] | undefined {
  return useLiveQuery(async () => (tripId ? checklistRepo.listShared(tripId) : []), [tripId]);
}

export function useTemplates(list: PrepList): ChecklistTemplate[] | undefined {
  return useLiveQuery(() => templateRepo.list(list), [list]);
}

export function useSavedPlaces(): SavedPlace[] | undefined {
  return useLiveQuery(() => savedPlaceRepo.listActive(), []);
}
