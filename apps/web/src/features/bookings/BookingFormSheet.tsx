import { useSettings } from '../../data/settingsStore';
import { attachFallback } from '../../data/limitNotice';
import { flightLink } from '../../shared/lib/fallbackLinks';
import { flightsApi } from '../../data/api/flights';
import { AirportField } from './AirportField';
import { isDomesticTrip } from '../../domain/tripPlace';
import { PlaceAutocomplete } from '../common/PlaceAutocomplete';
import { addDays, diffDays, type Booking, type Trip } from '@trippocket/shared';
import { Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { bookingRepo, type NewBooking } from '../../data/repositories/bookingRepo';
import { BottomSheet, Button, Chip, snackbar, TimeInput, toast } from '../../shared/ui';
import { BOOKING_ICON } from '../common/bookingKinds';

/** 픽업·드랍을 많이 예약하는 곳 (고르면 예약 사이트 칸에 들어감, 직접 입력도 됨) */
const TRANSFER_SITES = ['KKday', 'Klook', '아고다', '마이리얼트립', '네이버'] as const;

const KINDS: Booking['kind'][] = [
  'flight',
  'lodging',
  'restaurant',
  'train',
  'car',
  'transfer',
  'tour',
  'ticket',
  'other',
];

export interface BookingFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  /** 있으면 편집 */
  booking?: Booking | undefined;
}

/** S-17 예약 추가·편집: 종류를 고르면 종류에 맞는 칸만 보인다 */
export function BookingFormSheet({ open, onOpenChange, trip, booking }: BookingFormSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(booking ? 'bookings.editTitle' : 'bookings.addTitle')}
    >
      {open && (
        <BookingForm
          key={booking?.id ?? 'new'}
          trip={trip}
          booking={booking}
          onDone={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  );
}

const inputClass =
  'h-12 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

/** 빈 문자열 → undefined (저장소에서 그 항목을 지운다) */
const v = (s: string) => (s.trim() ? s.trim() : undefined);

function BookingForm({
  trip,
  booking: b,
  onDone,
}: {
  trip: Trip;
  booking: Booking | undefined;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Booking['kind']>(b?.kind ?? 'flight');
  const [f, setF] = useState({
    title: b?.title ?? '',
    provider: b?.provider ?? '',
    flightNo: b?.details?.flightNo ?? '',
    from: b?.start.place ?? '',
    to: b?.end?.place ?? '',
    startDate: b?.start.date ?? trip.startDate,
    startTime: b?.start.time ?? '',
    endDate: b?.end?.date ?? '',
    endTime: b?.end?.time ?? '',
    seat: b?.details?.seat ?? '',
    terminal: b?.details?.terminal ?? '',
    arrivalTerminal: b?.details?.arrivalTerminal ?? '',
    confirmationNo: b?.confirmationNo ?? '',
    address: b?.details?.address ?? '',
    phone: b?.details?.phone ?? '',
    priceNote: b?.priceNote ?? '',
    partySize: b?.details?.partySize ? String(b.details.partySize) : '',
    direction: (b?.details?.direction ?? 'pickup') as 'pickup' | 'drop',
    memo: b?.memo ?? '',
  });
  const [saving, setSaving] = useState(false);
  // 편명으로 불러오기 (AviationStack 무료 — 최근 운항 기준이라 날짜는 그대로, 시간·공항·터미널만 채움)
  const [looking, setLooking] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  async function lookupFlight() {
    setLooking(true);
    const res = await flightsApi.lookup(f.flightNo);
    setLooking(false);
    if (!res.ok) {
      // 한도는 안내 팝업이 따로 뜬다 — 항공편 정보 사이트를 대신 연다
      if (res.reason === 'limit') attachFallback([flightLink(f.flightNo)]);
      else toast(t(res.status === 404 ? 'bookings.lookupNone' : 'bookings.lookupFailed'));
      return;
    }
    const x = res.data;
    // 도착 시각이 출발보다 이르면 다음 날 도착
    const nextDay = !!x.from.time && !!x.to.time && x.to.time < x.from.time;
    setF((prev) => ({
      ...prev,
      flightNo: x.flightNo,
      provider: prev.provider || x.airline || '',
      from: x.from.iata ?? prev.from,
      to: x.to.iata ?? prev.to,
      startTime: x.from.time ?? prev.startTime,
      endTime: x.to.time ?? prev.endTime,
      terminal: x.from.terminal ? `T${x.from.terminal}` : prev.terminal,
      arrivalTerminal: x.to.terminal ? `T${x.to.terminal}` : prev.arrivalTerminal,
      endDate: nextDay ? addDays(prev.startDate, 1) : prev.startDate,
    }));
    setLookedUp(true);
  }
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [key]: e.target.value }));

  // 숙소 체크아웃 기본값: 여행 마지막 날 (체크인보다 뒤일 때), 아니면 다음 날
  const endDate =
    f.endDate ||
    (kind === 'lodging'
      ? diffDays(f.startDate, trip.endDate) > 0
        ? trip.endDate
        : addDays(f.startDate, 1)
      : f.startDate);

  /** 종류별 입력값 → 저장할 예약. 문제가 있으면 안내 문구 */
  function build(): NewBooking | string {
    const common = {
      tripId: trip.id,
      kind,
      confirmationNo: v(f.confirmationNo),
      memo: v(f.memo),
    };
    if (kind === 'flight') {
      if (!v(f.flightNo) && !v(f.from) && !v(f.to) && !v(f.title)) return t('bookings.needFlight');
      const title =
        v(f.title) ??
        t('bookings.flightTitle', {
          flightNo: f.flightNo.trim().toUpperCase(),
          from: f.from.trim().toUpperCase(),
          to: f.to.trim().toUpperCase(),
        }).trim();
      return clean({
        ...common,
        title,
        provider: v(f.provider),
        start: clean({ date: f.startDate, time: v(f.startTime), place: v(f.from)?.toUpperCase() }),
        end: clean({ date: endDate, time: v(f.endTime), place: v(f.to)?.toUpperCase() }),
        details: cleanOrUndefined({
          flightNo: v(f.flightNo)?.toUpperCase(),
          seat: v(f.seat),
          terminal: v(f.terminal),
          arrivalTerminal: v(f.arrivalTerminal),
        }),
      });
    }
    if (kind === 'transfer') {
      const party = Number(f.partySize);
      return clean({
        ...common,
        // 이름을 비우면 "공항 픽업" / "공항 드랍"
        title: v(f.title) ?? t(`bookings.transferTitle.${f.direction}`),
        provider: v(f.provider),
        start: clean({ date: f.startDate, time: v(f.startTime), place: v(f.from) }),
        end: v(f.to) ? clean({ date: f.startDate, place: v(f.to) }) : undefined,
        details: cleanOrUndefined({
          direction: f.direction,
          flightNo: v(f.flightNo)?.toUpperCase(),
          phone: v(f.phone),
          partySize: Number.isInteger(party) && party >= 1 && party <= 99 ? party : undefined,
        }),
        priceNote: v(f.priceNote),
      });
    }
    if (!v(f.title)) return t('bookings.needName');
    if (kind === 'restaurant') {
      const party = Number(f.partySize);
      return clean({
        ...common,
        title: f.title.trim(),
        provider: v(f.provider),
        start: clean({ date: f.startDate, time: v(f.startTime) }),
        details: cleanOrUndefined({
          address: v(f.address),
          phone: v(f.phone),
          partySize: Number.isInteger(party) && party >= 1 && party <= 99 ? party : undefined,
        }),
        priceNote: v(f.priceNote),
      });
    }
    if (kind === 'lodging') {
      if (diffDays(f.startDate, endDate) < 1) return t('bookings.checkOutBeforeIn');
      return clean({
        ...common,
        title: f.title.trim(),
        provider: v(f.provider),
        start: clean({ date: f.startDate, time: v(f.startTime) }),
        end: clean({ date: endDate, time: v(f.endTime) }),
        details: cleanOrUndefined({ address: v(f.address), phone: v(f.phone) }),
        priceNote: v(f.priceNote),
      });
    }
    return clean({
      ...common,
      title: f.title.trim(),
      provider: v(f.provider),
      start: clean({ date: f.startDate, time: v(f.startTime), place: v(f.from) }),
      priceNote: v(f.priceNote),
    });
  }

  async function submit() {
    const input = build();
    if (typeof input === 'string') {
      toast(input);
      return;
    }
    setSaving(true);
    try {
      if (b) {
        // 편집: 이번 종류에 없는 칸은 undefined로 지운다
        await bookingRepo.update(b.id, {
          kind: input.kind,
          title: input.title,
          provider: input.provider,
          confirmationNo: input.confirmationNo,
          start: input.start,
          end: input.end,
          details: input.details,
          priceNote: input.priceNote,
          memo: input.memo,
        });
        toast(t('form.saved'));
      } else {
        await bookingRepo.create(input);
        toast(t('bookings.added'));
      }
      onDone();
    } catch {
      setSaving(false);
      toast(t('form.failed'));
    }
  }

  async function remove() {
    if (!b) return;
    onDone();
    await bookingRepo.softDelete(b.id);
    snackbar(t('bookings.deleted'), {
      label: t('common.undo'),
      onAction: () => void bookingRepo.restore(b.id),
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-caption font-semibold text-fg-sub">
          {t('bookings.kind')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const Icon = BOOKING_ICON[k];
            return (
              <Chip
                key={k}
                selected={k === kind}
                onClick={() => setKind(k)}
                leading={<Icon aria-hidden="true" className="size-4" />}
              >
                {t(`bookingKind.${k}`)}
              </Chip>
            );
          })}
        </div>
      </fieldset>

      {kind === 'flight' ? (
        <>
          {/* 편명만 넣고 불러오기 — 점선으로 한 묶음 (사용자 요청 2026-10-25) */}
          <div className="flex flex-col gap-1.5 rounded-card border border-dashed border-primary/60 p-2.5">
            <label htmlFor="bk-flight" className="text-caption font-semibold text-fg-sub">
              {t('bookings.flightNo')}
            </label>
            <div className="flex gap-1.5">
              <input
                id="bk-flight"
                value={f.flightNo}
                maxLength={20}
                placeholder="KE703"
                onChange={set('flightNo')}
                className={`${inputClass} min-w-0 flex-1 uppercase`}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-12 shrink-0"
                loading={looking}
                disabled={!/^[a-z0-9]{2}\s?\d{1,4}[a-z]?$/i.test(f.flightNo.trim())}
                onClick={() => void lookupFlight()}
              >
                {t('bookings.lookup')}
              </Button>
            </div>
            <p className="text-micro text-fg-muted">{t('bookings.lookupHint')}</p>
          </div>
          <Field label={t('bookings.provider')}>
            <input
              id="bk-provider"
              value={f.provider}
              maxLength={60}
              onChange={set('provider')}
              className={inputClass}
            />
          </Field>
          {lookedUp && (
            <p role="status" className="text-caption text-fg-muted">
              {t('bookings.lookupNote')}
            </p>
          )}
          <Row>
            <AirportField
              id="bk-from"
              label={t('bookings.from')}
              value={f.from}
              placeholder={t('bookings.airportPlaceholder', { example: 'ICN' })}
              onChange={(value) => set('from')({ target: { value } })}
            />
            <AirportField
              id="bk-to"
              label={t('bookings.to')}
              value={f.to}
              placeholder={t('bookings.airportPlaceholder', { example: 'NRT' })}
              onChange={(value) => set('to')({ target: { value } })}
            />
          </Row>
          <DateTimeRow
            dateLabel={t('bookings.departDate')}
            timeLabel={t('bookings.departTime')}
            date={f.startDate}
            time={f.startTime}
            onDate={set('startDate')}
            onTime={set('startTime')}
            idPrefix="bk-depart"
          />
          <DateTimeRow
            dateLabel={t('bookings.arriveDate')}
            timeLabel={t('bookings.arriveTime')}
            date={endDate}
            time={f.endTime}
            onDate={set('endDate')}
            onTime={set('endTime')}
            idPrefix="bk-arrive"
          />
          <Row>
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
          <Field label={t('bookings.seat')}>
            <input
              id="bk-seat"
              value={f.seat}
              maxLength={20}
              onChange={set('seat')}
              className={inputClass}
            />
          </Field>
        </>
      ) : (
        <>
          <Field
            label={
              kind === 'lodging'
                ? t('bookings.lodgingName')
                : kind === 'restaurant'
                  ? t('bookings.restaurantName')
                  : kind === 'transfer'
                    ? t('bookings.transferName')
                    : t('bookings.name')
            }
          >
            <input
              id="bk-title"
              value={f.title}
              maxLength={100}
              onChange={set('title')}
              className={inputClass}
            />
          </Field>
          {/* 숙소·음식점: 이름을 치면 추천 3개 + 더보기, 고르면 주소·전화 채움 (사용자 요청 2026-10-25) */}
          {(kind === 'lodging' || kind === 'restaurant') && (
            <PlaceAutocomplete
              query={f.title}
              domestic={isDomesticTrip(trip)}
              near={trip.destinations.find((d) => d.coords)?.coords}
              onPick={(p) =>
                setF((cur) => ({
                  ...cur,
                  title: p.name,
                  address: p.address || cur.address,
                  phone: p.phone || cur.phone,
                }))
              }
            />
          )}
          {kind === 'lodging' ? (
            <>
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
            </>
          ) : kind === 'transfer' ? (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-caption font-semibold text-fg-sub">
                  {t('bookings.direction')}
                </legend>
                <div className="flex gap-2">
                  {(['pickup', 'drop'] as const).map((d) => (
                    <Chip
                      key={d}
                      selected={f.direction === d}
                      onClick={() => setF((cur) => ({ ...cur, direction: d }))}
                    >
                      {t(`bookings.directionValue.${d}`)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <Field label={t('bookings.site')}>
                <input
                  id="bk-site"
                  value={f.provider}
                  maxLength={60}
                  placeholder="KKday, Klook, 아고다…"
                  onChange={set('provider')}
                  className={inputClass}
                />
              </Field>
              <div className="-mt-3 flex flex-wrap gap-1.5">
                {TRANSFER_SITES.map((s) => (
                  <Chip
                    key={s}
                    selected={f.provider === s}
                    onClick={() => setF((cur) => ({ ...cur, provider: s }))}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
              <DateTimeRow
                dateLabel={t('bookings.date')}
                timeLabel={t('bookings.time')}
                date={f.startDate}
                time={f.startTime}
                onDate={set('startDate')}
                onTime={set('startTime')}
                idPrefix="bk-transfer"
              />
              <Row>
                <Field label={t('bookings.transferFrom')}>
                  <input
                    id="bk-from"
                    value={f.from}
                    maxLength={100}
                    placeholder={
                      f.direction === 'pickup'
                        ? t('bookings.airportHint')
                        : t('bookings.lodgingHint')
                    }
                    onChange={set('from')}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('bookings.transferTo')}>
                  <input
                    id="bk-to"
                    value={f.to}
                    maxLength={100}
                    placeholder={
                      f.direction === 'pickup'
                        ? t('bookings.lodgingHint')
                        : t('bookings.airportHint')
                    }
                    onChange={set('to')}
                    className={inputClass}
                  />
                </Field>
              </Row>
              <Row>
                <Field label={t('bookings.partySize')}>
                  <input
                    id="bk-party"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={f.partySize}
                    onChange={set('partySize')}
                    className={`${inputClass} tabular`}
                  />
                </Field>
                <Field label={t('bookings.flightNoOptional')}>
                  <input
                    id="bk-transfer-flight"
                    value={f.flightNo}
                    maxLength={20}
                    placeholder="KE703"
                    onChange={set('flightNo')}
                    className={`${inputClass} uppercase`}
                  />
                </Field>
              </Row>
              <Field label={t('bookings.driverPhone')}>
                <input
                  id="bk-phone"
                  type="tel"
                  value={f.phone}
                  maxLength={40}
                  onChange={set('phone')}
                  className={inputClass}
                />
              </Field>
            </>
          ) : kind === 'restaurant' ? (
            <>
              <DateTimeRow
                dateLabel={t('bookings.date')}
                timeLabel={t('bookings.time')}
                date={f.startDate}
                time={f.startTime}
                onDate={set('startDate')}
                onTime={set('startTime')}
                idPrefix="bk-meal"
              />
              <Row>
                <Field label={t('bookings.partySize')}>
                  <input
                    id="bk-party"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={f.partySize}
                    onChange={set('partySize')}
                    className={`${inputClass} tabular`}
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
              </Row>
              <Field label={t('bookings.address')}>
                <input
                  id="bk-address"
                  value={f.address}
                  maxLength={200}
                  onChange={set('address')}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <>
              <DateTimeRow
                dateLabel={t('bookings.date')}
                timeLabel={t('bookings.time')}
                date={f.startDate}
                time={f.startTime}
                onDate={set('startDate')}
                onTime={set('startTime')}
                idPrefix="bk-start"
              />
              <Field label={t('bookings.place')}>
                <input
                  id="bk-place"
                  value={f.from}
                  maxLength={100}
                  onChange={set('from')}
                  className={inputClass}
                />
              </Field>
            </>
          )}
          {kind !== 'transfer' && (
            <Field label={t('bookings.reseller')}>
              <input
                id="bk-provider"
                value={f.provider}
                maxLength={60}
                onChange={set('provider')}
                className={inputClass}
              />
            </Field>
          )}
          <Field label={t('bookings.priceNote')}>
            <input
              id="bk-price"
              value={f.priceNote}
              maxLength={100}
              placeholder={t('bookings.priceNotePlaceholder')}
              onChange={set('priceNote')}
              className={inputClass}
            />
          </Field>
        </>
      )}

      <Field label={t('bookings.confirmationNo')}>
        <input
          id="bk-no"
          value={f.confirmationNo}
          maxLength={60}
          onChange={set('confirmationNo')}
          className={`${inputClass} tabular`}
        />
      </Field>
      <Field label={t('bookings.memo')}>
        <textarea
          id="bk-memo"
          value={f.memo}
          maxLength={2000}
          rows={2}
          onChange={set('memo')}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={saving}>
        {t(b ? 'form.save' : 'bookings.add')}
      </Button>
      {b && (
        <Button
          variant="secondary"
          className="text-danger"
          leading={<Trash2 aria-hidden="true" className="size-4" />}
          onClick={() => void remove()}
        >
          {t('bookings.delete')}
        </Button>
      )}
    </form>
  );
}

/** undefined 값을 가진 키를 뺀다 (exactOptionalPropertyTypes) */
function clean<T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, val]) => val !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

function cleanOrUndefined<T extends object>(obj: T) {
  const c = clean(obj);
  return Object.keys(c).length ? c : undefined;
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-caption font-semibold text-fg-sub">{label}</span>
      {children}
    </label>
  );
}

function DateTimeRow(props: {
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
          className={`${inputClass} tabular`}
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
