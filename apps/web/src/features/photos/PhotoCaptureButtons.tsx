import { getTripStatus, todayIn, type Trip } from '@trippocket/shared';
import { lazy, Suspense, useState } from 'react';
import { useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { photoRepo } from '../../data/repositories/photoRepo';
import { photoTarget } from '../../domain/receipt';
import { useTranslation } from '../../i18n';
import { timeIn } from '../../shared/hooks/useMinuteClock';
import { shrinkImage } from '../../shared/lib/shrinkImage';
import { toast } from '../../shared/ui';
import { CaptureTile } from './CaptureTile';

const AttachPickSheet = lazy(() =>
  import('./AttachPickSheet').then((m) => ({ default: m.AttachPickSheet })),
);

type Pending = {
  files: File[];
  kind: 'photo' | 'receipt';
  trip: Trip;
  today: string;
  guess: string | null;
};

/**
 * 빠른 메뉴 [사진]·[영수증] (ADR-0012 — 2026-11-11): 휴대폰 카메라를 열거나 사진을 고른 뒤,
 * 붙일 일정을 여행 일정에서 고른다 (2026-11-13 사용자 요청, 지금 일정에 [지금] 표시).
 * 사진은 이 기기에만 (서버·동기화 없음, 백업 파일은 켰을 때만). trip이 없으면 지금 여행 중인 여행을 쓴다
 */
export function PhotoCaptureButtons({ trip }: { trip?: Trip | undefined }) {
  const { t } = useTranslation();
  const trips = useTrips();
  const [pending, setPending] = useState<Pending | null>(null);
  const target =
    trip ??
    trips?.find(
      (tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) === 'ongoing',
    );

  const ask = async (files: File[], kind: 'photo' | 'receipt') => {
    if (!target) return toast(t('photos.noTrip'));
    const all = (await itemRepo.listByTrip(target.id)).filter((i) => i.kind !== 'note');
    if (!all.length) return toast(t('photos.noItems'));
    const today = todayIn(target.timezone);
    const guess = photoTarget(
      all.filter((i) => i.date === today),
      timeIn(target.timezone, new Date()) ?? '00:00',
    );
    setPending({ files, kind, trip: target, today, guess });
  };

  const save = async (p: Pending, itemId: string, title: string) => {
    setPending(null);
    try {
      for (const file of p.files) {
        const blob = await shrinkImage(file);
        await photoRepo.add({ tripId: p.trip.id, itemId, kind: p.kind, blob });
      }
      toast(
        p.files.length > 1
          ? t('photos.attachedN', { title, n: p.files.length })
          : t('photos.attached', { title }),
      );
    } catch {
      toast(t('photos.failed'));
    }
  };

  return (
    <>
      <CaptureTile kind="photo" onFiles={(f) => void ask(f, 'photo')} />
      <CaptureTile kind="receipt" onFiles={(f) => void ask(f, 'receipt')} />
      {pending && (
        <Suspense fallback={null}>
          <AttachPickSheet
            trip={pending.trip}
            today={pending.today}
            guessId={pending.guess}
            label={t('photos.attachCount', {
              kind: t(`photos.${pending.kind}`),
              n: pending.files.length,
            })}
            onPick={(id, title) => void save(pending, id, title)}
            onClose={() => setPending(null)}
          />
        </Suspense>
      )}
    </>
  );
}
