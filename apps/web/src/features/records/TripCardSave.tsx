import { nightsBetween, type Trip } from '@trippocket/shared';
import { FileText, ImageDown } from 'lucide-react';
import { useState } from 'react';
import { useTripsData } from '../../data/hooks';
import { useLab } from '../../data/labsStore';
import { tripStoryText } from '../../domain/tripStory';
import { copyText } from '../../shared/lib/clipboard';
import { travelStats } from '../../domain/tripStats';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';
import { tripCardSvg, tripRange, type TripCardData } from './tripCard';

/**
 * 기록 탭 "여행 요약 카드" (실험실 tripCard, 2026-11-10): 다녀온 여행마다 [저장] → 탑승권 모양 PNG.
 * PNG로 바꾸고 저장하는 코드는 누를 때만 불러온다
 */
export function TripCardSave({ pastTrips }: { pastTrips: readonly Trip[] }) {
  const { t } = useTranslation();
  const data = useTripsData(pastTrips.map((tr) => tr.id));
  const [busy, setBusy] = useState<string | null>(null);
  // 실험실 "여행기 글로 복사" (2026-11-13)
  const storyOn = useLab('tripStory');
  if (pastTrips.length === 0) return null;
  const recent = [...pastTrips].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const save = (tr: Trip) => {
    if (!data) return;
    setBusy(tr.id);
    const s = travelStats([tr], data.items, data.bookings);
    const days = nightsBetween(tr.startDate, tr.endDate) + 1;
    const card: TripCardData = {
      title: tr.title,
      cities: tr.destinations.map((d) => d.name).join(' · '),
      range: tripRange(tr.startDate, tr.endDate),
      days,
      brand: 'TripPocket',
      facts: [
        [t('records.days'), t('travelReview.days', { n: days })],
        [t('travelReview.places'), t('travelReview.count', { n: s.places })],
        [t('tripCard.moved'), t('travelReview.km', { n: Math.round(s.walkKm + s.transitKm) })],
      ],
    };
    void Promise.all([import('./stampSheet'), import('../backup/backupUtils')])
      .then(async ([png, files]) => {
        const blob = await png.svgToPng(tripCardSvg(card));
        if (await files.saveFile('trippocket-trip.png', blob, tr.title, 'image/png'))
          toast(t('tripCard.saved'));
      })
      .catch(() => toast(t('records.stampFailed')))
      .finally(() => setBusy(null));
  };

  return (
    <section aria-label={t('tripCard.title')} className="flex flex-col gap-2">
      <h2 className="text-body-1 font-semibold">{t('tripCard.title')}</h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {recent.map((tr) => (
          <li key={tr.id} className="flex items-center gap-3 px-4 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-2 font-medium">{tr.title}</span>
              <span className="tabular font-mono text-caption text-fg-muted">
                {tripRange(tr.startDate, tr.endDate)}
              </span>
            </span>
            {storyOn && (
              <button
                type="button"
                disabled={!data}
                onClick={() =>
                  data &&
                  void copyText(
                    tripStoryText(
                      tr,
                      data.items.filter((i) => i.tripId === tr.id),
                      { dayN: (n) => t('plan.dayN', { n }), note: t('tripStory.note') },
                    ),
                    t('tripStory.copied'),
                  )
                }
                aria-label={t('tripStory.copyOf', { title: tr.title })}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-medium text-fg-sub disabled:opacity-50"
              >
                <FileText aria-hidden="true" className="size-4" />
                {t('tripStory.copy')}
              </button>
            )}
            <button
              type="button"
              disabled={!data || busy !== null}
              onClick={() => save(tr)}
              aria-label={t('tripCard.saveOf', { title: tr.title })}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-medium text-fg-sub disabled:opacity-50"
            >
              <ImageDown aria-hidden="true" className="size-4" />
              {t('tripCard.save')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
