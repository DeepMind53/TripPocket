import type { ItineraryItem } from '@trippocket/shared';
import { savedPlaceRepo, SavedLimitError } from './repositories/savedPlaceRepo';

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
