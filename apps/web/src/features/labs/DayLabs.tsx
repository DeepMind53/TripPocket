import type { Coords, ItineraryItem } from '@trippocket/shared';
import { MapPinOff, Route } from 'lucide-react';
import { useTripItems } from '../../data/hooks';
import { useLabs } from '../../data/labsStore';
import { farPlaceIds, shorterOrder } from '../../domain/tripHints';
import { useTranslation } from '../../i18n';
import { InlineIcon } from '../../shared/ui/InlineIcon';

const spotsOf = (items: readonly ItineraryItem[]) =>
  items
    .filter((i) => i.kind !== 'note' && !i.bookingId && i.place?.coords)
    .map((i) => ({ id: i.id, title: i.title, coords: i.place!.coords! }));

/**
 * 일정 화면 하루 아래 실험 2개 (2026-11-13): 더 짧은 순서(바꾸지 않고 알려만) · 멀리 떨어진 장소(잘못 고른 장소 찾기)
 */
export function DayLabs({ items }: { items: readonly ItineraryItem[] }) {
  const { t } = useTranslation();
  const labs = useLabs();
  const all = useTripItems(labs.farPlace ? items[0]?.tripId : undefined);
  const spots = spotsOf(items);
  const order = labs.shorterOrder ? shorterOrder(spots) : null;
  const allCoords: Coords[] = all ? spotsOf(all).map((s) => s.coords) : [];
  const far = labs.farPlace ? farPlaceIds(spots, allCoords) : new Set<string>();
  const farNames = spots.filter((s) => far.has(s.id)).map((s) => s.title);
  if (!order && !farNames.length) return null;
  return (
    <div className="flex flex-col gap-1 pb-2">
      {order && (
        <p className="rounded-btn bg-primary-weak px-3 py-2 text-caption whitespace-pre-line text-primary">
          <InlineIcon icon={Route} />
          {t('hint.shorter', { km: order.saveKm, order: order.titles.join(' → ') })}
        </p>
      )}
      {farNames.length > 0 && (
        <p className="rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub">
          <InlineIcon icon={MapPinOff} className="text-warning" />
          {t('hint.far', { names: farNames.join(', ') })}
        </p>
      )}
    </div>
  );
}
