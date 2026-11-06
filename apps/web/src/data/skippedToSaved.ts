import type { ItineraryItem } from '@trippocket/shared';
import { savedPlaceRepo, SavedLimitError } from './repositories/savedPlaceRepo';
import { itemRepo } from './repositories/itemRepo';

const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[\s·\-()]/g, '');

/**
 * 미방문으로 남긴 일정은 저장 탭으로 (사용자 요청 2026-10-27) — 다음 여행 때 다시 고를 수 있게.
 * 이미 저장한 곳(Google id가 같거나, 같은 나라에서 이름이 같음)이면 다시 저장하지 않는다.
 * 결과: saved = 새로 저장, exists = 이미 있음, limit = 200곳이 참, none = 장소 정보 없음
 */
export async function saveSkippedPlace(
  item: Pick<ItineraryItem, 'kind' | 'title' | 'place' | 'memo'>,
  where: { countryCode?: string | undefined; cityTag?: string | undefined },
): Promise<'saved' | 'exists' | 'limit' | 'none'> {
  if (item.kind === 'note' || !item.title.trim()) return 'none';
  const name = item.place?.name ?? item.title;
  const saved = await savedPlaceRepo.listActive();
  const dup = saved.some(
    (s) =>
      (item.place?.googlePlaceId && s.googlePlaceId === item.place.googlePlaceId) ||
      (norm(s.name) === norm(name) && (s.countryCode ?? where.countryCode) === where.countryCode),
  );
  if (dup) return 'exists';
  try {
    await savedPlaceRepo.create({
      name,
      kind: item.kind,
      ...(item.place?.address ? { address: item.place.address } : {}),
      ...(item.place?.coords ? { coords: item.place.coords } : {}),
      ...(item.place?.coordsSource ? { coordsSource: item.place.coordsSource } : {}),
      ...(item.place?.coordsFetchedAt ? { coordsFetchedAt: item.place.coordsFetchedAt } : {}),
      ...(item.place?.googlePlaceId ? { googlePlaceId: item.place.googlePlaceId } : {}),
      ...(item.place?.naverPlaceUrl ? { naverPlaceUrl: item.place.naverPlaceUrl } : {}),
      ...(where.cityTag ? { cityTag: where.cityTag } : {}),
      ...(where.countryCode ? { countryCode: where.countryCode } : {}),
    });
    return 'saved';
  } catch (e) {
    if (e instanceof SavedLimitError) return 'limit';
    throw e;
  }
}

/**
 * 방문·미방문 고르기 — 홈·일정·여행 모드가 모두 이것을 쓴다 (사용자 요청 2026-11-06, 어디서 눌러도 같게).
 * 같은 것을 다시 누르면 기록을 지운다(null). 미방문이면 저장 탭에도 담는다
 */
export async function applyVisit(
  item: ItineraryItem,
  visit: NonNullable<ItineraryItem['visit']> | null,
  trip: { destinations: readonly { countryCode?: string | undefined; name: string }[] },
): Promise<'saved' | 'exists' | 'limit' | 'none' | null> {
  await itemRepo.setVisit(item.id, visit);
  if (visit !== 'skipped') return null;
  return saveSkippedPlace(item, {
    countryCode: trip.destinations[0]?.countryCode,
    cityTag: trip.destinations[0]?.name,
  });
}
