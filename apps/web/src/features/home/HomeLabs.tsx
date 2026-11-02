import { todayIn, type Booking, type Trip } from '@trippocket/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLab } from '../../data/labsStore';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { useSettings } from '../../data/settingsStore';
import { vouchersNotSaved } from '../../domain/localInfo';
import { hoursAhead } from '../../domain/travelExtras';
import { useTranslation } from '../../i18n';

/**
 * 홈 여행 카드 아래 도움 줄:
 * - 출발 전 시차 (설정 "일정" — 2026-10-28 실험실에서 정식, Google 여행 참고)
 * - 실험실 "오프라인 준비" (2026-11-03): 출발 7일 전부터 — 기기에 안 받은 바우처, 오프라인 지도 받기
 */
export function HomeLabs({
  trip,
  bookings,
  ongoing,
}: {
  trip: Trip;
  bookings: readonly Booking[];
  ongoing: boolean;
}) {
  const { t } = useTranslation();
  const jetLagOn = useSettings((s) => s.jetLag);
  const today = todayIn(trip.timezone);
  const soon =
    !ongoing &&
    trip.startDate >= today &&
    Date.parse(trip.startDate) - Date.parse(today) <= 7 * 86_400_000;
  const offlineOn = useLab('offlineReady') && soon;
  const docs = useLiveQuery(
    () => (offlineOn ? attachmentRepo.listByTrip(trip.id) : []),
    [offlineOn, trip.id],
  );

  const lines: string[] = [];
  const ahead = jetLagOn && !ongoing ? hoursAhead(trip.timezone) : null;
  if (ahead !== null)
    lines.push(
      ahead === 0
        ? t('labs.jetLagSame')
        : t(ahead > 0 ? 'labs.jetLagAhead' : 'labs.jetLagBehind', { h: Math.abs(ahead) }),
    );
  if (offlineOn && docs) {
    const n = vouchersNotSaved(
      bookings,
      new Set(docs.filter((d) => d.blob).map((d) => d.bookingId)),
    );
    if (n > 0) lines.push(t('offlineReady.vouchers', { n }));
    lines.push(t('offlineReady.maps'));
  }
  if (!lines.length) return null;
  return (
    <ul aria-label={t('labs.homeLabel')} className="flex flex-col gap-1">
      {lines.map((l, i) => (
        <li
          key={`${i}-${l}`}
          className="rounded-btn bg-bg-subtle px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          {l}
        </li>
      ))}
    </ul>
  );
}
