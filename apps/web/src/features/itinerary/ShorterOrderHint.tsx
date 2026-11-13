import type { ItineraryItem } from '@trippocket/shared';
import { Route } from 'lucide-react';
import { useSettings } from '../../data/settingsStore';
import { shorterOrder } from '../../domain/tripHints';
import { useTranslation } from '../../i18n';
import { InlineIcon } from '../../shared/ui/InlineIcon';

/**
 * 더 짧은 순서 (설정 "일정 · 알림", 2026-11-13 실험실에서 정식): 하루 장소 순서를 바꾸면 직선 합이 줄 때
 * 그 순서를 알려만 준다 (바꾸지 않음). 메모·예약에서 넘어온 일정은 빼고 좌표가 있는 장소만
 */
export function ShorterOrderHint({ items }: { items: readonly ItineraryItem[] }) {
  const { t } = useTranslation();
  const on = useSettings((s) => s.shorterOrder);
  if (!on) return null;
  const order = shorterOrder(
    items
      .filter((i) => i.kind !== 'note' && !i.bookingId && i.place?.coords)
      .map((i) => ({ id: i.id, title: i.title, coords: i.place!.coords! })),
  );
  if (!order) return null;
  return (
    <p className="mb-2 rounded-btn bg-primary-weak px-3 py-2 text-caption whitespace-pre-line text-primary">
      <InlineIcon icon={Route} />
      {t('hint.shorter', { km: order.saveKm, order: order.titles.join(' → ') })}
    </p>
  );
}
