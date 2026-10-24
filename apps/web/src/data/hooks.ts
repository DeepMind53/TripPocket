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

export function useTripBookings(tripId: string | undefined): Booking[] | undefined {
  return useLiveQuery(async () => (tripId ? bookingRepo.listByTrip(tripId) : []), [tripId]);
}

export function useChecklist(
  tripId: string | undefined,
  list: ListKind,
): ChecklistItem[] | undefined {
  return useLiveQuery(async () => (tripId ? checklistRepo.list(tripId, list) : []), [tripId, list]);
}

export function useTemplates(list: PrepList): ChecklistTemplate[] | undefined {
  return useLiveQuery(() => templateRepo.list(list), [list]);
}

export function useSavedPlaces(): SavedPlace[] | undefined {
  return useLiveQuery(() => savedPlaceRepo.listActive(), []);
}
