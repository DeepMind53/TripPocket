import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from '../../i18n';
import { Button } from '../../shared/ui';
import { baggageWithUnit } from '../../domain/flightBaggage';
import { AirportField } from './AirportField';
import {
  ConfirmationField,
  DateTimeRow,
  Field,
  inputClass,
  Row,
  type OnText,
} from './BookingFields';
import type { BookingFormValues } from './bookingForm';

/** 예약 양식 — 항공 칸: 편명 불러오기, 출발·도착 공항·터미널·시각, 좌석·수하물 */
export function FlightFields({
  f,
  setF,
  set,
  endDate,
  more,
  bagHint,
  looking,
  lookedUp,
  onLookup,
}: {
  f: BookingFormValues;
  setF: Dispatch<SetStateAction<BookingFormValues>>;
  set: (key: keyof BookingFormValues) => OnText;
  endDate: string;
  more: boolean;
  bagHint: { cabin: string; checked: string };
  looking: boolean;
  lookedUp: boolean;
  onLookup: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* 출발 날짜 + 편명 → 불러오기 — 점선으로 한 묶음 (사용자 요청 2026-10-25, 날짜도 이 안에 2026-11-02) */}
      <div className="flex flex-col gap-1.5 rounded-card border border-dashed border-primary/60 p-2.5">
        {/* 아래 출발 날짜와 같은 값 — 어느 쪽을 고쳐도 함께 바뀐다 (사용자 요청 2026-11-02) */}
        {/* 출발 날짜 · 편명 · 불러오기 한 줄 (사용자 요청 2026-11-02) */}
        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_auto] items-end gap-1.5 tight:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 tight:col-span-2">
            <Field label={t('bookings.departDate')}>
              <input
                id="bk-lookup-date"
                type="date"
                required
                value={f.startDate}
                onChange={set('startDate')}
                className={`${inputClass} tabular px-2 text-body-2`}
              />
            </Field>
          </div>
          <Field label={t('bookings.flightNo')}>
            <input
              id="bk-flight"
              value={f.flightNo}
              maxLength={20}
              placeholder="KE703"
              onChange={set('flightNo')}
              className={`${inputClass} px-2 uppercase`}
            />
          </Field>
          <Button
            size="sm"
            variant="secondary"
            className="h-12 px-2"
            loading={looking}
            disabled={!/^[a-z0-9]{2}\s?\d{1,4}[a-z]?$/i.test(f.flightNo.trim())}
            onClick={onLookup}
          >
            {t('bookings.lookup')}
          </Button>
        </div>
        <p className="text-micro whitespace-pre-line text-fg-muted">{t('bookings.lookupHint')}</p>
      </div>
      {/* 항공사 | 예약번호 한 줄 (사용자 요청 2026-11-24) */}
      <Row>
        <Field label={t('bookings.provider')}>
          <input
            id="bk-provider"
            value={f.provider}
            maxLength={60}
            onChange={set('provider')}
            className={inputClass}
          />
        </Field>
        <ConfirmationField value={f.confirmationNo} onChange={set('confirmationNo')} />
      </Row>
      {lookedUp && (
        <p role="status" className="text-caption text-fg-muted">
          {t('bookings.lookupNote')}
        </p>
      )}
      {/* 출발(공항·터미널·날짜·시각) | 점선 | 도착 — 묶음으로 나눠 보기 (사용자 요청 2026-11-04) */}
      <Row>
        <AirportField
          id="bk-from"
          label={t('bookings.from')}
          value={f.from}
          placeholder={t('bookings.airportPlaceholder')}
          onChange={(value) => set('from')({ target: { value } })}
        />
        <Field label={t('bookings.departTerminal')}>
          <input
            id="bk-terminal"
            value={f.terminal}
            maxLength={20}
            placeholder="T1"
            onChange={set('terminal')}
            className={inputClass}
          />
        </Field>
      </Row>
      <DateTimeRow
        dateLabel={t('bookings.departDate')}
        timeLabel={t('bookings.departTime')}
        date={f.startDate}
        time={f.startTime}
        onDate={set('startDate')}
        onTime={set('startTime')}
        idPrefix="bk-depart"
        // 도착 날짜와 같은 칸으로 고칠 수 있게 (사용자 요청 2026-11-24) — 위 점선 칸과 같은 값이라 어느 쪽을 고쳐도 함께 바뀐다
      />
      <hr aria-hidden="true" className="my-1 border-t-2 border-dashed border-line" />
      <Row>
        <AirportField
          id="bk-to"
          label={t('bookings.to')}
          value={f.to}
          placeholder={t('bookings.airportPlaceholder')}
          onChange={(value) => set('to')({ target: { value } })}
        />
        <Field label={t('bookings.arriveTerminal')}>
          <input
            id="bk-arrival-terminal"
            value={f.arrivalTerminal}
            maxLength={20}
            placeholder="T2"
            onChange={set('arrivalTerminal')}
            className={inputClass}
          />
        </Field>
      </Row>
      <DateTimeRow
        dateLabel={t('bookings.arriveDate')}
        timeLabel={t('bookings.arriveTime')}
        date={endDate}
        time={f.endTime}
        onDate={set('endDate')}
        onTime={set('endTime')}
        idPrefix="bk-arrive"
      />
      {more && (
        <>
          {/* 좌석 · 기내 · 위탁 한 줄 (사용자 요청 2026-11-24) */}
          <div className="grid grid-cols-3 gap-2">
            <Field label={t('bookings.seat')}>
              <input
                id="bk-seat"
                value={f.seat}
                maxLength={20}
                placeholder="32A"
                onChange={set('seat')}
                className={`${inputClass} px-2`}
              />
            </Field>
            <Field label={t('bookings.baggageCabin')}>
              <input
                id="bk-baggage-cabin"
                value={f.baggageCabin}
                maxLength={25}
                inputMode="decimal"
                placeholder={bagHint.cabin}
                onChange={set('baggageCabin')}
                onBlur={() =>
                  setF((cur) => ({ ...cur, baggageCabin: baggageWithUnit(cur.baggageCabin) }))
                }
                className={`${inputClass} px-2`}
              />
            </Field>
            <Field label={t('bookings.baggageChecked')}>
              <input
                id="bk-baggage-checked"
                value={f.baggageChecked}
                maxLength={25}
                inputMode="decimal"
                placeholder={bagHint.checked}
                onChange={set('baggageChecked')}
                onBlur={() =>
                  setF((cur) => ({
                    ...cur,
                    baggageChecked: baggageWithUnit(cur.baggageChecked),
                  }))
                }
                className={`${inputClass} px-2`}
              />
            </Field>
          </div>
        </>
      )}
    </>
  );
}
