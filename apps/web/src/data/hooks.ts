import { useLiveQuery } from 'dexie-react-hooks';
import type { ItineraryItem, Trip } from '@trippocket/shared';
import { itemRepo } from './repositories/itemRepo';
import { tripRepo } from './repositories/tripRepo';

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
