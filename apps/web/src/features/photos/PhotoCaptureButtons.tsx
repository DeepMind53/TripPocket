import { getTripStatus, todayIn, type Trip } from '@trippocket/shared';
import { useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { photoRepo } from '../../data/repositories/photoRepo';
import { photoTarget } from '../../domain/receipt';
import { useTranslation } from '../../i18n';
import { timeIn } from '../../shared/hooks/useMinuteClock';
import { shrinkImage } from '../../shared/lib/shrinkImage';
import { toast } from '../../shared/ui';
import { CaptureTile } from './CaptureTile';

/**
 * 빠른 메뉴 [사진]·[영수증] (실험실 "사진·영수증", ADR-0012 — 2026-11-11): 휴대폰 카메라를 열고, 찍으면
 * 지금 일정(없으면 바로 앞 → 다음)에 붙인다. 사진은 이 기기에만 (서버·동기화·백업 없음).
 * trip이 없으면 지금 여행 중인 여행을 쓴다
 */
export function PhotoCaptureButtons({ trip }: { trip?: Trip | undefined }) {
  const { t } = useTranslation();
  const trips = useTrips();
  const target =
    trip ??
    trips?.find(
      (tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) === 'ongoing',
    );

  const save = async (files: File[], kind: 'photo' | 'receipt') => {
    if (!target) return toast(t('photos.noTrip'));
    const today = todayIn(target.timezone);
    const items = (await itemRepo.listByTrip(target.id)).filter((i) => i.date === today);
    const itemId = photoTarget(items, timeIn(target.timezone, new Date()) ?? '00:00');
    const item = items.find((i) => i.id === itemId);
    if (!item) return toast(t('photos.noItem'));
    try {
      for (const file of files) {
        const blob = await shrinkImage(file);
        await photoRepo.add({ tripId: target.id, itemId: item.id, kind, blob });
      }
      toast(
        files.length > 1
          ? t('photos.attachedN', { title: item.title, n: files.length })
          : t('photos.attached', { title: item.title }),
      );
    } catch {
      toast(t('photos.failed'));
    }
  };

  return (
    <>
      <CaptureTile kind="photo" onFiles={(f) => void save(f, 'photo')} />
      <CaptureTile kind="receipt" onFiles={(f) => void save(f, 'receipt')} />
    </>
  );
}
