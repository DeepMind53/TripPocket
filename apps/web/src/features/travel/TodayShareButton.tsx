import type { Booking, ItineraryItem, Trip } from '@trippocket/shared';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { shareApi, shareUrl } from '../../data/api/share';
import { useAuth } from '../../data/authStore';
import { tripToText } from '../../domain/shareText';
import { useTranslation } from '../../i18n';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { copyText } from '../../shared/lib/clipboard';
import { IconButton } from '../../shared/ui';

/**
 * 실험실 "오늘 일정 보내기" (docs/27 E1, 2026-11-25): 여행 모드 머리에서 오늘 일정만 보낸다.
 * 보기 전용 공유 링크가 켜져 있으면 그 링크에 ?day=오늘 (받는 사람은 그날만 본다), 없으면 오늘 일정 글.
 * 휴대폰 공유 창이 있으면 그걸로, 없으면 복사
 */
export function TodayShareButton({
  trip,
  today,
  items,
  bookings,
}: {
  trip: Trip;
  today: string;
  items: readonly ItineraryItem[];
  bookings: readonly Booking[];
}) {
  const { t } = useTranslation();
  const { time } = useTimeText();
  const loggedIn = useAuth((s) => s.status === 'user');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const link = loggedIn ? await shareApi.get(trip.id) : null;
      const id = link?.ok ? link.data.share?.id : undefined;
      const text = id
        ? `${trip.title} ${t('travel.todayShareTitle')}\n${shareUrl(id)}?day=${today}`
        : tripToText(
            { ...trip, startDate: today, endDate: today },
            items.filter((i) => i.date === today && !i.planId),
            bookings.filter((b) => b.start.date === today),
            time,
          );
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text });
          return;
        } catch (e) {
          // 사용자가 공유 창을 닫으면 그대로 끝
          if (e instanceof DOMException && e.name === 'AbortError') return;
        }
      }
      await copyText(text, t('travel.todayShareCopied'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <IconButton
      label={t('travel.todayShare')}
      icon={<Send />}
      disabled={busy}
      onClick={() => void send()}
    />
  );
}
