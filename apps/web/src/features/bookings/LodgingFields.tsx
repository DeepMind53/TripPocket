import { useState, type Dispatch, type SetStateAction } from 'react';
import { diffDays, nightsBetween, type Trip } from '@trippocket/shared';
import { BadgePercent, CalendarRange, EggFried } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Button, Chip, Switch, toast } from '../../shared/ui';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { bookingDefaultTimes } from '../../domain/defaultTimes';
import { isDomesticTrip } from '../../domain/tripPlace';
import { LodgingPriceSheet } from '../lodging/LodgingPriceSheet';
import { StayRangeSheet } from './StayRangeSheet';
import { DateTimeRow, Field, inputClass, PartyField, Row, type OnText } from './BookingFields';
import { morningsOf, type BookingFormValues } from './bookingForm';

/** 예약 양식 — 숙소 칸: 체크인~체크아웃 달력, 최저가, 조식 날짜, 주소·전화, 객실·인원 */
export function LodgingFields({
  f,
  setF,
  set,
  endDate,
  more,
  trip,
}: {
  f: BookingFormValues;
  setF: Dispatch<SetStateAction<BookingFormValues>>;
  set: (key: keyof BookingFormValues) => OnText;
  endDate: string;
  more: boolean;
  trip: Trip;
}) {
  const { t } = useTranslation();
  const [stayOpen, setStayOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const mornings = morningsOf(f.startDate, endDate);
  const breakfastOn = (d: string) =>
    f.breakfast && (!f.breakfastDates || f.breakfastDates.includes(d));
  return (
    <>
      {/* 달력 하나로 체크인~체크아웃 (사용자 요청 2026-10-25) — 아래 날짜 칸으로 직접 고쳐도 됨 */}
      <button
        type="button"
        onClick={() => setStayOpen(true)}
        className="tabular flex items-center justify-between gap-2 rounded-card border border-dashed border-primary/60 px-3 py-2.5 text-left"
      >
        <span className="flex flex-col">
          <span className="text-caption text-fg-muted">{t('stay.button')}</span>
          <span className="text-body-2 font-semibold">
            {formatMonthDay(f.startDate)} → {formatMonthDay(endDate)}
            {diffDays(f.startDate, endDate) > 0 &&
              ` · ${t('bookings.nights', { n: nightsBetween(f.startDate, endDate) })}`}
          </span>
        </span>
        <CalendarRange aria-hidden="true" className="size-5 text-primary" />
      </button>
      <StayRangeSheet
        open={stayOpen}
        onOpenChange={setStayOpen}
        trip={trip}
        checkIn={f.startDate}
        checkOut={endDate}
        onPick={(inDate, outDate) =>
          setF((cur) => ({ ...cur, startDate: inDate, endDate: outDate }))
        }
      />
      <DateTimeRow
        dateLabel={t('bookings.checkIn')}
        timeLabel={t('bookings.checkInTime')}
        date={f.startDate}
        time={f.startTime}
        onDate={set('startDate')}
        onTime={set('startTime')}
        idPrefix="bk-in"
      />
      <DateTimeRow
        dateLabel={t('bookings.checkOut')}
        timeLabel={t('bookings.checkOutTime')}
        date={endDate}
        time={f.endTime}
        onDate={set('endDate')}
        onTime={set('endTime')}
        idPrefix="bk-out"
      />
      {/* 실험실 "숙소 최저가": 쓰던 칸이 사라지지 않게 시트로 (docs/28 Q5) */}
      {
        <>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={!f.title.trim() || endDate <= f.startDate}
            leading={<BadgePercent aria-hidden="true" className="size-4" />}
            onClick={() => setPriceOpen(true)}
          >
            {t('lodgingPrice.button')}
          </Button>
          <LodgingPriceSheet
            open={priceOpen}
            onOpenChange={setPriceOpen}
            initial={{
              name: f.title.trim(),
              checkIn: f.startDate,
              checkOut: endDate,
              domestic: isDomesticTrip(trip),
            }}
            // 숙소 안내 시각: 비었거나 기본값(15:00·11:00)일 때만 (2026-11-24)
            onHotelTimes={(h) => {
              const def = bookingDefaultTimes('lodging');
              const open = (v: string, d: string) => v === '' || v === d;
              const inT = open(f.startTime, def.start) ? h.checkInTime : undefined;
              const outT = open(f.endTime, def.end) ? h.checkOutTime : undefined;
              if ((!inT || inT === f.startTime) && (!outT || outT === f.endTime)) return;
              setF((cur) => ({
                ...cur,
                ...(inT ? { startTime: inT } : {}),
                ...(outT ? { endTime: outT } : {}),
              }));
              toast(t('bookings.hotelTimesFilled', { name: h.name }));
            }}
          />
        </>
      }
      {/* 조식 포함 — 날짜별로 (사용자 요청 2026-10-26) */}
      <div className="flex flex-col gap-2 rounded-card bg-bg-subtle px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-body-2 font-medium">
              <InlineIcon icon={EggFried} />
              {t('bookings.breakfast')}
            </span>
            <span className="text-caption text-fg-muted">{t('bookings.breakfastDesc')}</span>
          </span>
          <Switch
            label={t('bookings.breakfast')}
            checked={f.breakfast}
            onCheckedChange={(on) =>
              setF((cur) => ({ ...cur, breakfast: on, breakfastDates: null }))
            }
          />
        </div>
        {f.breakfast && mornings.length > 0 && (
          <div
            role="group"
            aria-label={t('bookings.breakfastDays')}
            className="flex flex-wrap gap-1.5"
          >
            {mornings.map((d) => (
              <Chip
                key={d}
                selected={breakfastOn(d)}
                onClick={() =>
                  setF((cur) => {
                    const now = cur.breakfastDates ?? mornings;
                    const next = now.includes(d) ? now.filter((x) => x !== d) : [...now, d];
                    return {
                      ...cur,
                      breakfastDates: next.length === mornings.length ? null : next,
                    };
                  })
                }
              >
                <span className="tabular">{formatMonthDay(d)}</span>
              </Chip>
            ))}
          </div>
        )}
      </div>
      <Field label={t('bookings.address')}>
        <input
          id="bk-address"
          value={f.address}
          maxLength={200}
          onChange={set('address')}
          className={inputClass}
        />
      </Field>
      <Field label={t('bookings.phone')}>
        <input
          id="bk-phone"
          type="tel"
          value={f.phone}
          maxLength={40}
          onChange={set('phone')}
          className={inputClass}
        />
      </Field>
      {more && (
        <Row>
          <Field label={t('bookings.roomType')}>
            <input
              id="bk-room"
              value={f.roomType}
              maxLength={60}
              placeholder={t('bookings.roomPlaceholder')}
              onChange={set('roomType')}
              className={inputClass}
            />
          </Field>
          <PartyField value={f.partySize} onChange={set('partySize')} />
        </Row>
      )}
    </>
  );
}
