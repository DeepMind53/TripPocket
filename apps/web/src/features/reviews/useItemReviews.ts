import { placeKeyOf, type ItineraryItem } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { reviewsApi, type ItemReviews } from '../../data/api/reviews';
import { useAuth } from '../../data/authStore';

/** 일정 상세를 열 때 그 장소·일정의 후기 (로그인·온라인일 때만, 저장하지 않음). version을 바꾸면 다시 받음 */
export function useItemReviews(
  tripId: string,
  item: ItineraryItem | undefined,
  enabled: boolean,
  version: number,
): ItemReviews | null {
  const loggedIn = useAuth((s) => s.status === 'user');
  const [data, setData] = useState<{ key: string; value: ItemReviews } | null>(null);
  const placeKey = placeKeyOf(item?.place);
  const key = `${tripId}|${item?.id}|${placeKey}|${version}`;

  useEffect(() => {
    if (!enabled || !item || !loggedIn) return;
    let alive = true;
    void reviewsApi.forItem(tripId, item.id, placeKey).then((r) => {
      if (alive && r.ok) setData({ key, value: r.data });
    });
    return () => {
      alive = false;
    };
  }, [key, enabled, loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return data?.key === key ? data.value : null;
}
