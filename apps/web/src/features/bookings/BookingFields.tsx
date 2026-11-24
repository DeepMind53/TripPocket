import type { ReactNode } from 'react';
import { useSettings } from '../../data/settingsStore';
import { useTranslation } from '../../i18n';
import { Chip, ScrollRow, TimeInput } from '../../shared/ui';
import { BOOKING_ICON } from '../common/bookingKinds';
import type { TransferSpot } from '../../domain/transferSpots';

/** 예약 양식의 작은 칸 부품 (BookingFormSheet에서만 씀) */

export const inputClass =
  'h-12 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

export type OnText = (e: { target: { value: string } }) => void;

export function PartyField(props: { value: string; onChange: OnText }) {
  const { t } = useTranslation();
  return (
    <Field label={t('bookings.partySize')}>
      <input
        id="bk-party"
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        value={props.value}
        onChange={props.onChange}
        className={`${inputClass} tabular`}
      />
    </Field>
  );
}

export function MeetingField(props: { value: string; onChange: OnText }) {
  const { t } = useTranslation();
  return (
    <Field label={t('bookings.meetingPoint')}>
      <input
        id="bk-meeting"
        value={props.value}
        maxLength={100}
        placeholder={t('bookings.meetingPlaceholder')}
        onChange={props.onChange}
        className={inputClass}
      />
    </Field>
  );
}

/** 픽업·드랍: 이 여행에 넣은 공항·숙소 칩 */
export function SpotChips({
  spots,
  value,
  onPick,
}: {
  spots: TransferSpot[];
  value: string;
  onPick: (spot: TransferSpot) => void;
}) {
  const { t } = useTranslation();
  if (spots.length === 0) return null;
  return (
    <ScrollRow role="group" aria-label={t('bookings.spotChips')} className="-mt-3 flex gap-2 pb-1">
      {spots.map((s) => {
        const Icon = BOOKING_ICON[s.kind === 'airport' ? 'flight' : 'lodging'];
        return (
          <Chip
            key={s.key}
            selected={value === s.name}
            onClick={() => onPick(s)}
            leading={<Icon aria-hidden="true" className="size-4" />}
          >
            {s.name}
          </Chip>
        );
      })}
    </ScrollRow>
  );
}

/** 예약번호 칸 — 항공은 항공사 옆, 나머지는 아래 */
export function ConfirmationField({ value, onChange }: { value: string; onChange: OnText }) {
  const { t } = useTranslation();
  return (
    <Field label={t('bookings.confirmationNo')}>
      <input
        id="bk-no"
        value={value}
        maxLength={60}
        onChange={onChange}
        className={`${inputClass} tabular`}
      />
    </Field>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-caption font-semibold text-fg-sub">{label}</span>
      {children}
    </label>
  );
}

export function DateTimeRow(props: {
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  onDate: (e: { target: { value: string } }) => void;
  onTime: (e: { target: { value: string } }) => void;
  idPrefix: string;
}) {
  const timeStep = useSettings((st) => st.timeStepMin) * 60;
  return (
    <Row>
      <Field label={props.dateLabel}>
        <input
          id={`${props.idPrefix}-date`}
          type="date"
          required
          value={props.date}
          onChange={props.onDate}
          // 좁은 화면(320px)에서 연도·일이 잘리지 않게
          className={`${inputClass} tabular tight:px-1.5 tight:text-body-2 tight:tracking-tight`}
        />
      </Field>
      <Field label={props.timeLabel}>
        <TimeInput
          id={`${props.idPrefix}-time`}
          step={timeStep}
          value={props.time}
          onChange={(value) => props.onTime({ target: { value } })}
        />
      </Field>
    </Row>
  );
}
