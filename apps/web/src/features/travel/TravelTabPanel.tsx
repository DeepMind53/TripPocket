import { lazy, Suspense } from 'react';
import { useTranslation } from '../../i18n';
import { Skeleton, TopBar } from '../../shared/ui';

import type { TravelTabId } from './travelTabs';

/** 여행 모드 아래 탭으로 여는 화면 — 누를 때만 불러온다 */
const PANELS = {
  weather: lazy(async () => ({ default: (await import('../weather/WeatherPage')).WeatherPage })),
  checklist: lazy(async () => ({
    default: (await import('../checklist/ChecklistPage')).ChecklistPage,
  })),
  bookings: lazy(async () => ({
    default: (await import('../bookings/BookingsPage')).BookingsPage,
  })),
  fx: lazy(async () => ({ default: (await import('../fx/FxPage')).FxPage })),
  phrases: lazy(async () => ({ default: (await import('../phrases/PhrasesPage')).PhrasesPage })),
  essentials: lazy(async () => ({
    default: (await import('../essentials/EssentialsPage')).EssentialsPage,
  })),
} satisfies Record<TravelTabId, unknown>;

/** 여행 탭 머리(TripLayout) 없이 쓰는 화면은 제목 줄을 붙인다 — 뒤로 = 여행 모드 첫 화면 */
const NEEDS_TOP: readonly TravelTabId[] = ['checklist', 'bookings'];

/**
 * 여행 모드 아래 탭 (사용자 요청 2026-11-10): 화면을 옮기지 않고 내용만 바꿔 보여 준다 → 아래 탭은 그대로.
 * 기능은 원래 화면 그대로 (같은 부품)
 */
export function TravelTabPanel({ id, tripId }: { id: TravelTabId; tripId: string }) {
  const { t } = useTranslation();
  const Panel = PANELS[id];
  return (
    <div className="-mx-5 pb-4">
      {NEEDS_TOP.includes(id) && (
        <TopBar title={t(`travel.thumbs.${id}`)} backTo={`/trips/${tripId}/go`} />
      )}
      <Suspense fallback={<Skeleton />}>
        <Panel />
      </Suspense>
    </div>
  );
}
