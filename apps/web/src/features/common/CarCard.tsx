import type { Booking } from '@trippocket/shared';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { ShowCard } from '../phrases/ShowCard';

/**
 * 빠른 메뉴 "렌터카" (사용자 요청 2026-11-02): 주차장에서 내 차를 찾기 쉽게 차량번호를 화면 가득,
 * 아래에 차종·반납 날짜·시간·장소
 */
export function CarCard({
  car,
  open,
  onClose,
}: {
  car: Booking | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!car) return null;
  const plate = car.details?.plate;
  const ret = car.end;
  return (
    <ShowCard
      open={open}
      onClose={onClose}
      big={plate ?? car.title}
      sub={
        ret
          ? t('car.return', {
              date: formatMonthDay(ret.date),
              time: ret.time ?? '',
              place: ret.place ?? '',
            }).trim()
          : undefined
      }
    >
      <p className="text-title-2 text-fg-sub">
        {[car.details?.carModel, car.provider].filter(Boolean).join(' · ') ||
          (plate ? car.title : '')}
      </p>
    </ShowCard>
  );
}
