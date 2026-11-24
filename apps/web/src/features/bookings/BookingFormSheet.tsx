import { useSettings } from '../../data/settingsStore';
import { bookingDefaultTimes, switchTimes } from '../../domain/defaultTimes';
import { attachFallback } from '../../data/limitNotice';
import { flightLink } from '../../shared/lib/fallbackLinks';
import { flightsApi } from '../../data/api/flights';
import { isDomesticTrip, tripCountries } from '../../domain/tripPlace';
import { PlaceAutocomplete } from '../common/PlaceAutocomplete';
import { BookingScanButton } from './BookingScanButton';
import { FlightFields } from './FlightFields';
import { LodgingFields } from './LodgingFields';
import {
  buildBooking,
  bookingEndDate,
  CANCEL_KINDS,
  initialBookingForm,
  KINDS,
  PARTY_KINDS,
  PAYMENT_KINDS,
  PHONE_KINDS,
  PICK_KINDS,
  VOUCHER_KINDS,
} from './bookingForm';
import {
  ConfirmationField,
  DateTimeRow,
  Field,
  inputClass,
  MeetingField,
  PartyField,
  Row,
  SpotChips,
} from './BookingFields';
import { applyScan } from '../../domain/bookingScan';
import { StationField } from './StationPicker';
import {
  addDays,
  baggageFor,
  COUNTRY_CURRENCY,
  transitNames,
  weekday,
  type Booking,
  isOutsideHours,
  type PlaceDetails,
  type PlaceSummary,
  type Trip,
} from '@trippocket/shared';
import { Trash2, TriangleAlert } from 'lucide-react';
import { BookingDocs } from './BookingDocs';
import { useEffect, useState } from 'react';
import { routeEtaResult } from '../../data/api/routes';
import { useTranslation } from '../../i18n';
import { syncBookingToPlan } from '../../data/bookingPlanner';
import { placesApi } from '../../data/api/places';
import { useTripBookings } from '../../data/hooks';
import { dropSuggestion, transferSpots, type TransferSpot } from '../../domain/transferSpots';
import { baggageHint } from '../../domain/flightBaggage';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import {
  BottomSheet,
  Button,
  CancelSaveRow,
  Chip,
  ScrollRow,
  snackbar,
  TimeInput,
  toast,
} from '../../shared/ui';
import { BOOKING_ICON } from '../common/bookingKinds';
import { confirmDelete, useSheetDirty } from '../../shared/ui';

/** 픽업·드랍을 많이 예약하는 곳 (고르면 예약 사이트 칸에 들어감, 직접 입력도 됨) */
const TRANSFER_SITES = ['KKday', 'Klook', '아고다', '마이리얼트립', '네이버'] as const;

export interface BookingFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  /** 있으면 편집 */
  booking?: Booking | undefined;
  /** 새 예약의 처음 종류 (빈 화면 버튼에서) */
  initialKind?: Booking['kind'] | undefined;
}

/** S-17 예약 추가·편집: 종류를 고르면 종류에 맞는 칸만 보인다 */
export function BookingFormSheet({
  open,
  onOpenChange,
  trip,
  booking,
  initialKind,
}: BookingFormSheetProps) {
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
          initialKind={initialKind}
          onDone={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  );
}

function BookingForm({
  trip,
  booking: b,
  initialKind,
  onDone,
}: {
  trip: Trip;
  booking: Booking | undefined;
  initialKind?: Booking['kind'] | undefined;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Booking['kind']>(b?.kind ?? initialKind ?? 'flight');
  const [f, setF] = useState(() => initialBookingForm(trip, b, initialKind));
  const transit = transitNames(tripCountries(trip));
  const tripBookings = useTripBookings(trip.id);
  const spots = transferSpots(
    (tripBookings ?? []).filter((x) => x.id !== b?.id),
    f.direction,
  );
  // 빈 수하물 칸의 회색 참고값: 그 항공사 대표 무게 (사용자 요청 2026-11-24), 모르면 흔한 값
  const bagInfo = kind === 'flight' ? baggageFor(f.provider, f.flightNo) : undefined;
  const bagHint = {
    cabin: baggageHint(bagInfo?.cabin) ?? '7kg',
    checked: baggageHint(bagInfo?.checked) ?? '23kg',
  };
  const timeStep = useSettings((st) => st.timeStepMin) * 60;
  const [saving, setSaving] = useState(false);
  // 드랍 추천 출발 시각 (2026-11-24): 고른 항공편 + 숙소 → 공항 차로 가는 시간 (길 조회 1번, 기기에 7일 보관)
  const [dropFlight, setDropFlight] = useState<{
    date: string;
    time: string;
    international: boolean;
  } | null>(null);
  const [driveMin, setDriveMin] = useState<number | null>(null);
  const dropFrom = kind === 'transfer' && f.direction === 'drop' ? f.fromCoords : undefined;
  const dropTo = dropFlight ? f.toCoords : undefined;
  useEffect(() => {
    if (!dropFrom || !dropTo) return;
    let alive = true;
    void routeEtaResult(dropFrom, dropTo, !isDomesticTrip(trip), false, true).then((r) => {
      if (alive) setDriveMin(r.eta?.drive ?? null);
    });
    return () => {
      alive = false;
    };
  }, [dropFrom, dropTo, trip]);
  const dropTip =
    dropFrom && dropTo && dropFlight && driveMin !== null
      ? { ...dropSuggestion(dropFlight, driveMin, dropFlight.international), drive: driveMin }
      : null;
  const [hours, setHours] = useState<{ name: string; periods: PlaceDetails['periods'] } | null>(
    null,
  );
  const outsideHours =
    kind === 'restaurant' &&
    !!hours &&
    hours.name === f.title &&
    !!f.startTime &&
    isOutsideHours(hours.periods, weekday(f.startDate), f.startTime);
  // 덜 쓰는 칸은 접어 둔다 (docs/20 U4) — 고칠 때 값이 있으면 펼쳐서
  const d0 = b?.details;
  const [more, setMore] = useState(
    !!(
      d0?.seat ||
      b?.provider ||
      b?.priceNote ||
      b?.memo ||
      d0?.baggage ||
      d0?.cancelBy ||
      d0?.payment ||
      d0?.voucherUrl ||
      d0?.insurance ||
      d0?.roomType
    ),
  );
  // 편명으로 불러오기 (AviationStack 무료 — 최근 운항 기준이라 날짜는 그대로, 시간·공항·터미널만 채움)
  const [looking, setLooking] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  // 닫기 보호 (docs/31 A1): 처음 연 값과 다르면 닫기 전에 묻는다
  const snapshot = JSON.stringify([kind, f]);
  const [initial] = useState(snapshot);
  useSheetDirty(!saving && snapshot !== initial);
  /** base: 캡처로 막 채운 값처럼 아직 화면 상태에 들어가지 않은 값으로 부를 때 */
  async function lookupFlight(base: typeof f = f) {
    setLooking(true);
    const res = await flightsApi.lookup(base.flightNo);
    setLooking(false);
    if (!res.ok) {
      // 한도는 안내 팝업이 따로 뜬다 — 항공편 정보 사이트를 대신 연다
      if (res.reason === 'limit') attachFallback([flightLink(base.flightNo)]);
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
    // 인천공항 터미널이 비면 인천공항 운항 정보로 (무료, 출발 3일 전~6일 후만, 2026-11-24)
    const from = (x.from.iata ?? base.from).toUpperCase();
    const to = (x.to.iata ?? base.to).toUpperCase();
    const needDep = from === 'ICN' && !x.from.terminal && !base.terminal.trim();
    const needArr = to === 'ICN' && !x.to.terminal && !base.arrivalTerminal.trim();
    if (!needDep && !needArr) return;
    const r = await flightsApi.airport(x.flightNo, {
      date: base.startDate,
      ...(needDep ? { from } : {}),
      ...(needArr ? { to, arrDate: nextDay ? addDays(base.startDate, 1) : base.startDate } : {}),
    });
    if (!r.ok) return;
    const dep = r.data.dep?.info?.terminal;
    const arr = r.data.arr?.info?.terminal;
    setF((cur) => ({
      ...cur,
      ...(dep && !cur.terminal.trim() ? { terminal: dep.slice(0, 20) } : {}),
      ...(arr && !cur.arrivalTerminal.trim() ? { arrivalTerminal: arr.slice(0, 20) } : {}),
    }));
  }
  /** 해외(Google) 장소는 검색 결과에 전화번호가 없다 — 고를 때 한 번 확인해서 연락처 칸이 비면 채운다 */
  // 식당은 같은 응답의 영업시간도 — 예약 시각이 영업시간 밖이면 알림 (저장하지 않음, 2026-11-24)
  async function fillGooglePhone(p: PlaceSummary, still: (cur: typeof f) => boolean) {
    if (!PHONE_KINDS.has(kind) || p.source !== 'google') return;
    if (p.phone && kind !== 'restaurant') return;
    const r = await placesApi.googleDetails(p.id);
    if (r.ok && kind === 'restaurant' && r.data.periods?.length)
      setHours({ name: p.name, periods: r.data.periods });
    const phone = r.ok && !p.phone ? r.data.phone?.trim().slice(0, 40) : undefined;
    if (!phone) return;
    // 그사이 다른 곳을 골랐거나 직접 적었으면 그대로
    setF((cur) => (still(cur) && !cur.phone.trim() ? { ...cur, phone } : cur));
  }
  /** 픽업·드랍: 예약한 공항·숙소 칩 — 공항이면 그 항공편 편명·날짜도 (비어 있을 때) */
  function pickSpot(side: 'from' | 'to', spot: TransferSpot) {
    setF((cur) => ({
      ...cur,
      [side]: spot.name,
      [side === 'from' ? 'fromCoords' : 'toCoords']: spot.coords,
      ...(spot.flightNo && !cur.flightNo.trim()
        ? { flightNo: spot.flightNo, ...(spot.date ? { startDate: spot.date } : {}) }
        : {}),
      // 픽업: 시간이 비어 있으면 그 항공편 도착 시각
      ...(cur.direction === 'pickup' && spot.time && !cur.startTime
        ? { startTime: spot.time }
        : {}),
    }));
    // 드랍: 공항을 고르면 그 항공편 출발 시각으로 추천 시간 계산
    if (side === 'to')
      setDropFlight(
        f.direction === 'drop' && spot.time && spot.date
          ? { date: spot.date, time: spot.time, international: !!spot.international }
          : null,
      );
  }
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [key]: e.target.value }));

  const endDate = bookingEndDate(kind, f, trip);

  async function submit() {
    const input = buildBooking(kind, f, trip);
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
        // 일정표에 들어간 그 예약 일정도 고친 내용으로 (사용자 요청 2026-10-26)
        await syncBookingToPlan(b.id, (airport) => t('plan.arriveAt', { airport }));
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
    if (!(await confirmDelete(t('confirm.item', { name: b.title })))) return;
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
      {/* 사진으로 예약 정보 자동 채우기 — 종류를 고르기 전에 (사용자 요청 2026-11-24).
          사진이 항공권이면 항공, 숙소면 숙소로 바꾸고 채운다 (고치는 예약은 종류를 그대로) */}
      <BookingScanButton
        kind={kind}
        refDate={trip.startDate}
        currency={(() => {
          const c = tripCountries(trip).find((x) => x !== 'KR');
          return c ? COUNTRY_CURRENCY[c] : undefined;
        })()}
        onScan={(scan, scanned, from) => {
          const target =
            !b && (KINDS as readonly string[]).includes(scanned)
              ? (scanned as Booking['kind'])
              : kind;
          // 종류가 바뀌면 그 종류의 시각 초기값부터 (종류 버튼과 같게)
          const times =
            target !== kind
              ? switchTimes(
                  { start: f.startTime, end: f.endTime },
                  bookingDefaultTimes(kind),
                  bookingDefaultTimes(target),
                )
              : { start: f.startTime, end: f.endTime };
          const base = { ...f, startTime: times.start, endTime: times.end };
          const { patch, filled } = applyScan(target, scan, base, !b);
          if (target !== kind) setKind(target);
          if (filled === 0) {
            setF(base);
            toast(t('tool.scanNone'));
            return;
          }
          const next = { ...base, ...patch };
          setF(next);
          toast(t(from === 'barcode' ? 'tool.scanBarcode' : 'tool.scanFilled', { n: filled }));
          // 편명은 찾았는데 시각이 비면 편명 불러오기로 채운다 (탑승권 바코드엔 시각이 없음, 무료 조회)
          if (target === 'flight' && next.flightNo.trim() && (!next.startTime || !next.endTime))
            void lookupFlight(next);
        }}
      />

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
                onClick={() => {
                  // 새 예약이면 종류에 맞는 시각 초기값 (직접 고친 시각은 그대로)
                  if (!b) {
                    const next = switchTimes(
                      { start: f.startTime, end: f.endTime },
                      bookingDefaultTimes(kind),
                      bookingDefaultTimes(k),
                    );
                    setF((cur) => ({ ...cur, startTime: next.start, endTime: next.end }));
                  }
                  setKind(k);
                }}
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
          <FlightFields
            f={f}
            setF={setF}
            set={set}
            endDate={endDate}
            more={more}
            bagHint={bagHint}
            looking={looking}
            lookedUp={lookedUp}
            onLookup={() => void lookupFlight()}
          />
        </>
      ) : (
        <>
          {/* 기차·버스: 여행 나라의 교통수단 이름 칩 — 누르면 이름 칸에 (사용자 요청 2026-11-02) */}
          {kind === 'train' && transit.length > 0 && (
            <ScrollRow
              role="group"
              aria-label={t('bookings.transitChips')}
              className="-mb-2 flex gap-2 pb-1"
            >
              {transit.map((name) => (
                <Chip
                  key={name}
                  selected={f.title === name}
                  onClick={() => setF((cur) => ({ ...cur, title: name }))}
                >
                  {name}
                </Chip>
              ))}
            </ScrollRow>
          )}
          {kind === 'car' ? (
            // 렌터카: 이름 대신 차종·차량번호 (빠른 메뉴에 차량번호를 크게, 사용자 요청 2026-11-02)
            <Row>
              <Field label={t('bookings.carModel')}>
                <input
                  id="bk-car-model"
                  value={f.carModel}
                  maxLength={40}
                  placeholder={t('bookings.carModelPlaceholder')}
                  onChange={set('carModel')}
                  className={inputClass}
                />
              </Field>
              <Field label={t('bookings.plate')}>
                <input
                  id="bk-plate"
                  value={f.plate}
                  maxLength={20}
                  placeholder={t('bookings.platePlaceholder')}
                  onChange={set('plate')}
                  className={`${inputClass} uppercase`}
                />
              </Field>
            </Row>
          ) : kind === 'train' ? (
            // 기차·버스: 날짜 | 교통편 한 줄 (사용자 요청 2026-11-03 — 칸을 작게)
            <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-2">
              <Field label={t('bookings.date')}>
                <input
                  id="bk-start-date"
                  type="date"
                  required
                  value={f.startDate}
                  onChange={set('startDate')}
                  className={`${inputClass} tabular px-2`}
                />
              </Field>
              <Field label={t('station.vehicle')}>
                <input
                  id="bk-title"
                  value={f.title}
                  maxLength={100}
                  placeholder={t('station.vehiclePlaceholder')}
                  onChange={set('title')}
                  className={inputClass}
                />
              </Field>
            </div>
          ) : (
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
                // 이름을 직접 고치면 검색으로 고른 좌표는 버린다 (다른 곳일 수 있다)
                onChange={(e) =>
                  setF((cur) => ({
                    ...cur,
                    title: e.target.value,
                    ...(PICK_KINDS.has(kind) ? { fromCoords: undefined } : {}),
                  }))
                }
                className={inputClass}
              />
            </Field>
          )}
          {/* 숙소·음식점: 이름을 치면 추천 3개 + 더보기, 고르면 주소·전화 채움 (사용자 요청 2026-10-25) */}
          {(kind === 'lodging' || kind === 'restaurant') && (
            <PlaceAutocomplete
              query={f.title}
              domestic={isDomesticTrip(trip)}
              near={trip.destinations.find((d) => d.coords)?.coords}
              onPick={(p) => {
                setF((cur) => ({
                  ...cur,
                  title: p.name,
                  address: p.address || cur.address,
                  phone: p.phone || cur.phone,
                  // 좌표도 저장 — 빠른 메뉴 숙소 방향·일정 지도 핀 (2026-11-24, 전에는 버려서 숙소 방향이 늘 "위치 없음")
                  fromCoords: p.coords ?? undefined,
                }));
                // 해외(Google)는 검색 결과에 전화번호가 없다 — 고를 때 한 번 확인 (사용자 요청 2026-11-24)
                void fillGooglePhone(p, (cur) => cur.title === p.name);
              }}
            />
          )}
          {kind === 'lodging' ? (
            <>
              <LodgingFields
                f={f}
                setF={setF}
                set={set}
                endDate={endDate}
                more={more}
                trip={trip}
              />
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
              {/* 출발·도착 위치도 장소 검색 (사용자 요청 2026-10-26) — 한 줄에 하나씩, 추천 목록이 넓게 */}
              <Field label={t('bookings.transferFrom')}>
                <input
                  id="bk-from"
                  value={f.from}
                  maxLength={100}
                  placeholder={
                    f.direction === 'pickup' ? t('bookings.airportHint') : t('bookings.lodgingHint')
                  }
                  onChange={(e) =>
                    setF((cur) => ({ ...cur, from: e.target.value, fromCoords: undefined }))
                  }
                  className={inputClass}
                />
              </Field>
              {/* 예약한 공항·숙소에서 바로 고르기 (사용자 요청 2026-11-24) */}
              <SpotChips
                spots={f.direction === 'pickup' ? spots.airports : spots.lodgings}
                value={f.from}
                onPick={(spot) => pickSpot('from', spot)}
              />
              <PlaceAutocomplete
                query={f.from}
                domestic={isDomesticTrip(trip)}
                near={trip.destinations.find((d) => d.coords)?.coords}
                onPick={(p) =>
                  setF((cur) => ({
                    ...cur,
                    from: p.name.slice(0, 100),
                    fromCoords: p.coords ?? undefined,
                  }))
                }
              />
              <Field label={t('bookings.transferTo')}>
                <input
                  id="bk-to"
                  value={f.to}
                  maxLength={100}
                  placeholder={
                    f.direction === 'drop' ? t('bookings.airportHint') : t('bookings.lodgingHint')
                  }
                  onChange={(e) =>
                    setF((cur) => ({ ...cur, to: e.target.value, toCoords: undefined }))
                  }
                  className={inputClass}
                />
              </Field>
              <SpotChips
                spots={f.direction === 'pickup' ? spots.lodgings : spots.airports}
                value={f.to}
                onPick={(spot) => pickSpot('to', spot)}
              />
              {dropTip && (
                <div className="-mt-2 flex items-center justify-between gap-2 rounded-card bg-bg-subtle px-3 py-2">
                  <span className="flex flex-col">
                    <span className="tabular text-body-2 font-semibold">
                      {t('bookings.dropSuggest', { time: dropTip.time })}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {t('bookings.dropSuggestWhy', {
                        drive: dropTip.drive,
                        lead: dropTip.leadHours,
                      })}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={f.startTime === dropTip.time && f.startDate === dropTip.date}
                    onClick={() =>
                      setF((cur) => ({ ...cur, startDate: dropTip.date, startTime: dropTip.time }))
                    }
                  >
                    {t('bookings.dropSuggestUse')}
                  </Button>
                </div>
              )}
              <PlaceAutocomplete
                query={f.to}
                domestic={isDomesticTrip(trip)}
                near={trip.destinations.find((d) => d.coords)?.coords}
                onPick={(p) =>
                  setF((cur) => ({
                    ...cur,
                    to: p.name.slice(0, 100),
                    toCoords: p.coords ?? undefined,
                  }))
                }
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
              <MeetingField value={f.meetingPoint} onChange={set('meetingPoint')} />
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
              {outsideHours && (
                <p
                  role="alert"
                  className="-mt-3 flex items-center gap-1 text-caption font-semibold text-warning"
                >
                  <TriangleAlert aria-hidden="true" className="size-3.5" />
                  {t('placeSearch.outsideHours', { time: f.startTime })}
                </p>
              )}
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
              {kind === 'train' ? (
                // 기차·버스: 출발 시각 | 출발역, 도착 시각 | 도착역 (역을 고르면 주소·좌표도, 사용자 요청 2026-11-03)
                <>
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                    <Field label={t('station.departTime')}>
                      <TimeInput
                        id="bk-start-time"
                        step={timeStep}
                        value={f.startTime}
                        onChange={(value) => setF((cur) => ({ ...cur, startTime: value }))}
                      />
                    </Field>
                    <Field label={t('station.from')}>
                      <StationField
                        id="bk-place"
                        label={t('station.from')}
                        value={f.from}
                        address={f.fromAddress}
                        chip={f.title}
                        domestic={isDomesticTrip(trip)}
                        country={tripCountries(trip).find((c) => c !== 'KR')}
                        onChange={(p) =>
                          setF((cur) => ({
                            ...cur,
                            from: p.name.slice(0, 100),
                            fromCoords: p.coords,
                            fromAddress: p.address,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                    <Field label={t('station.arriveTime')}>
                      <TimeInput
                        id="bk-arrive-time"
                        step={timeStep}
                        value={f.endTime}
                        onChange={(value) => setF((cur) => ({ ...cur, endTime: value }))}
                      />
                    </Field>
                    <Field label={t('station.to')}>
                      <StationField
                        id="bk-arrive-place"
                        label={t('station.to')}
                        value={f.to}
                        address={f.toAddress}
                        chip={f.title}
                        domestic={isDomesticTrip(trip)}
                        country={tripCountries(trip).find((c) => c !== 'KR')}
                        onChange={(p) =>
                          setF((cur) => ({
                            ...cur,
                            to: p.name.slice(0, 100),
                            toCoords: p.coords,
                            toAddress: p.address,
                          }))
                        }
                      />
                    </Field>
                  </div>
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
                  <Field label={kind === 'car' ? t('bookings.carPickup') : t('bookings.place')}>
                    <input
                      id="bk-place"
                      value={f.from}
                      maxLength={100}
                      onChange={(e) =>
                        setF((cur) => ({ ...cur, from: e.target.value, fromCoords: undefined }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  {/* 역·터미널·렌터카 지점: 검색해서 고르면 좌표도 저장 (길찾기, 사용자 요청 2026-11-02) */}
                  {kind === 'car' && (
                    <PlaceAutocomplete
                      query={f.from}
                      domestic={isDomesticTrip(trip)}
                      near={trip.destinations.find((d) => d.coords)?.coords}
                      onPick={(p) => {
                        const from = p.name.slice(0, 100);
                        setF((cur) => ({
                          ...cur,
                          from,
                          fromCoords: p.coords ?? undefined,
                          // 대여 지점 연락처 (2026-11-24)
                          phone: p.phone || cur.phone,
                        }));
                        void fillGooglePhone(p, (cur) => cur.from === from);
                      }}
                    />
                  )}
                  {kind === 'car' && (
                    <>
                      <DateTimeRow
                        dateLabel={t('bookings.returnDate')}
                        timeLabel={t('bookings.returnTime')}
                        date={f.endDate || f.startDate}
                        time={f.endTime}
                        onDate={set('endDate')}
                        onTime={set('endTime')}
                        idPrefix="bk-return"
                      />
                      <Field label={t('bookings.carReturn')}>
                        <input
                          id="bk-return-place"
                          value={f.to}
                          maxLength={100}
                          onChange={(e) =>
                            setF((cur) => ({ ...cur, to: e.target.value, toCoords: undefined }))
                          }
                          className={inputClass}
                        />
                      </Field>
                      <PlaceAutocomplete
                        query={f.to}
                        domestic={isDomesticTrip(trip)}
                        near={trip.destinations.find((d) => d.coords)?.coords}
                        onPick={(p) =>
                          setF((cur) => ({
                            ...cur,
                            to: p.name.slice(0, 100),
                            toCoords: p.coords ?? undefined,
                          }))
                        }
                      />
                    </>
                  )}
                </>
              )}
              {kind === 'train' && (
                <Field label={t('bookings.trainSeat')}>
                  <input
                    id="bk-train-seat"
                    value={f.seat}
                    maxLength={20}
                    placeholder={t('bookings.trainSeatPlaceholder')}
                    onChange={set('seat')}
                    className={inputClass}
                  />
                </Field>
              )}
              {kind === 'tour' && (
                <>
                  <MeetingField
                    value={f.meetingPoint}
                    onChange={(e) =>
                      setF((cur) => ({
                        ...cur,
                        meetingPoint: e.target.value,
                        meetCoords: undefined,
                      }))
                    }
                  />
                  {/* 만나는 곳도 장소 검색 — 고르면 좌표까지 (사용자 요청 2026-11-24) */}
                  <PlaceAutocomplete
                    query={f.meetingPoint}
                    domestic={isDomesticTrip(trip)}
                    near={trip.destinations.find((d) => d.coords)?.coords}
                    onPick={(p) =>
                      setF((cur) => ({
                        ...cur,
                        meetingPoint: p.name.slice(0, 100),
                        meetCoords: p.coords ?? undefined,
                      }))
                    }
                  />
                </>
              )}
              {PARTY_KINDS.has(kind) && (
                <Row>
                  <PartyField value={f.partySize} onChange={set('partySize')} />
                  {kind === 'tour' && (
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
                  )}
                </Row>
              )}
              {kind === 'car' && more && (
                <Row>
                  <Field label={t('bookings.insurance')}>
                    <input
                      id="bk-insurance"
                      value={f.insurance}
                      maxLength={60}
                      placeholder={t('bookings.insurancePlaceholder')}
                      onChange={set('insurance')}
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
                </Row>
              )}
            </>
          )}
          {/* 예약처: 기차·버스·렌터카·투어·티켓·기타는 늘 보이게 (사용자 요청 2026-10-27), 숙소·식당은 [더 입력하기] */}
          {(more || (kind !== 'lodging' && kind !== 'restaurant')) && kind !== 'transfer' && (
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
          {more && CANCEL_KINDS.has(kind) && (
            <Field label={t('bookings.cancelBy')}>
              <input
                id="bk-cancel"
                type="date"
                value={f.cancelBy}
                onChange={set('cancelBy')}
                className={`${inputClass} tabular`}
              />
            </Field>
          )}
          {more && PAYMENT_KINDS.has(kind) && (
            <fieldset>
              <legend className="mb-1.5 text-caption font-semibold text-fg-sub">
                {t('bookings.payment')}
              </legend>
              <div className="flex gap-2">
                {(['paid', 'onsite'] as const).map((p) => (
                  <Chip
                    key={p}
                    selected={f.payment === p}
                    // 한 번 더 누르면 해제
                    onClick={() => setF((cur) => ({ ...cur, payment: cur.payment === p ? '' : p }))}
                  >
                    {t(`bookings.paymentValue.${p}`)}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
          {more && VOUCHER_KINDS.has(kind) && (
            <Field label={t('bookings.voucherUrl')}>
              <input
                id="bk-voucher"
                type="url"
                inputMode="url"
                value={f.voucherUrl}
                maxLength={500}
                placeholder="https://"
                onChange={set('voucherUrl')}
                className={inputClass}
              />
            </Field>
          )}
          {more && (
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
          )}
        </>
      )}

      {kind !== 'flight' && (
        <ConfirmationField value={f.confirmationNo} onChange={set('confirmationNo')} />
      )}
      {more ? (
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
      ) : (
        <button
          type="button"
          onClick={() => setMore(true)}
          className="self-start text-caption font-semibold text-primary"
        >
          {t('bookings.more')}
        </button>
      )}

      {b ? (
        <BookingDocs trip={trip} booking={b} canEdit />
      ) : (
        <p className="text-caption text-fg-muted">{t('docs.afterSave')}</p>
      )}

      {/* [저장]은 아래에 붙어 있게 — 칸이 많아도 바로 누를 수 있게 */}
      <CancelSaveRow docked onCancel={onDone}>
        <Button type="submit" size="lg" fullWidth loading={saving}>
          {t(b ? 'form.save' : 'bookings.add')}
        </Button>
      </CancelSaveRow>
      {b && (
        <Button
          variant="dangerSoft"
          leading={<Trash2 aria-hidden="true" className="size-4" />}
          onClick={() => void remove()}
        >
          {t('bookings.delete')}
        </Button>
      )}
    </form>
  );
}
