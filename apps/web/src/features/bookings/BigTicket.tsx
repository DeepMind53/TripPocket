import type { Booking } from '@trippocket/shared';
import { Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet } from '../../shared/ui';

/**
 * 실험실 "항공권 크게 보기" (2026-10-27, TripIt 참고): 카운터·게이트에서 화면을 보여 줄 때
 * 예약번호·편명·구간·좌석을 아주 크게
 */
export function BigTicket({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const flightNo = b.details?.flightNo ?? b.title;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-1 px-1 text-caption font-semibold text-primary"
      >
        <Maximize2 aria-hidden="true" className="size-4" />
        {t('labs.bigTicket')}
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t('labs.bigTicketOf', { name: flightNo })}
      >
        <div className="flex flex-col items-center gap-4 pb-4 text-center">
          <p className="tabular text-[40px] leading-none font-black tracking-wide">{flightNo}</p>
          <p className="tabular text-title-2">
            {b.start.place ?? ''} → {b.end?.place ?? ''}
          </p>
          <p className="tabular text-body-1 text-fg-sub">
            {formatMonthDay(b.start.date)} {b.start.time ?? ''}
          </p>
          {b.confirmationNo && (
            <div className="flex flex-col gap-1">
              <span className="text-caption text-fg-muted">{t('bookings.confirmationNo')}</span>
              <span className="tabular text-[34px] leading-none font-black tracking-[0.12em]">
                {b.confirmationNo}
              </span>
            </div>
          )}
          {b.details?.seat && (
            <p className="tabular text-title-2">
              {t('bookings.seat')} {b.details.seat}
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
