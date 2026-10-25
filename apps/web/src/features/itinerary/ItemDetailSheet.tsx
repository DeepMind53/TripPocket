import { useTimeText } from '../../shared/hooks/useTimeText';
import type { Booking, ItineraryItem } from '@trippocket/shared';
import {
  ArrowDown,
  ArrowUp,
  CalendarArrowUp,
  Copy,
  ExternalLink,
  MapPinned,
  Navigation,
  Pencil,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { isReviewKind } from '@trippocket/shared';
import { ItemReviews } from '../reviews/ItemReviews';
import { useItemReviews } from '../reviews/useItemReviews';

const ReviewSheet = lazy(() =>
  import('../reviews/ReviewSheet').then((m) => ({ default: m.ReviewSheet })),
);
import { useTranslation } from '../../i18n';
import { placeLink, openMapLink, type MapApp } from '../../shared/lib/directions';
import { BottomSheet, Button, Switch, TimeInput, toast } from '../../shared/ui';
import { copyText } from '../../shared/lib/clipboard';
import { FlightTicket } from '../bookings/BookingCard';
import { BookingDocs } from '../bookings/BookingDocs';
import { KIND_ICON } from './itemKinds';

export interface ItemDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItineraryItem | undefined;
  /** "N일차 · 10.25 (토)" 또는 "가고 싶은 곳" */
  dayLabel: string;
  /** 여행 중일 때만 "다녀왔어요" 표시 */
  showDone: boolean;
  /** 지도에서 보기에 쓸 앱 (국내=네이버, 해외=구글) */
  mapApp: MapApp;
  onDirections: () => void;
  onEdit: () => void;
  onMoveDay: () => void;
  onDelete: () => void;
  onToggleDone: (done: boolean) => void;
  /** 같은 날 안에서의 위치 (1부터) */
  position: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** 보기 전용 여행: 편집·순서·다녀왔어요·옮기기·삭제를 숨김 */
  readOnly?: boolean;
  /** 이 일정과 연결된 예약 (항공·숙소·음식점 등, domain/lodging bookingForItem) */
  booking?: Booking | undefined;
  onOpenBooking?: () => void;
  /** 방문 시간 빠른 입력 ("" = 지움) */
  onVisitTime?: (time: string) => void;
  /** 후기 (docs/17): 여행 id, 다녀온 날인지, 장소 연결 검색용 국내 여부·근처 */
  tripId?: string;
  visited?: boolean;
  domestic?: boolean;
  near?: { lat: number; lng: number } | undefined;
}

/** S-12 일정 상세 */
export function ItemDetailSheet({
  open,
  onOpenChange,
  item,
  dayLabel,
  showDone,
  mapApp,
  onDirections,
  onEdit,
  onMoveDay,
  onDelete,
  onToggleDone,
  position,
  total,
  onMoveUp,
  onMoveDown,
  readOnly = false,
  booking,
  onOpenBooking,
  onVisitTime,
  tripId,
  visited = false,
  domestic = true,
  near,
}: ItemDetailSheetProps) {
  const { t } = useTranslation();
  // 후기: 숙소·맛집·카페·쇼핑·관광·액티비티만, 보기 전용 공유는 못 씀 (사용자 결정 2026-10-25)
  const reviewKind = item && isReviewKind(item.kind) ? item.kind : null;
  const canReview = !!reviewKind && !!tripId && !readOnly;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVersion, setReviewVersion] = useState(0);
  const reviews = useItemReviews(
    tripId ?? '',
    item,
    open && !!reviewKind && !!tripId,
    reviewVersion,
  );
  const mine = reviews?.mine ?? null;
  const address = item?.place?.address;
  // 종류별 맞춤 (docs/16 D1): 이동·메모는 주소가 없으면 주소·지도 관련을 숨긴다
  const isMove = item?.kind === 'transport';
  const isNote = item?.kind === 'note';
  const placeLike = !isNote && !(isMove && !address && !item?.place?.coords);
  const hasPlace = !!address || !!item?.place?.coords;

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast(t('detail.addressCopied'));
    } catch {
      toast(t('common.copyFailed'));
    }
  }

  const Icon = item ? KIND_ICON[item.kind] : null;
  const { time: fmt } = useTimeText();
  const time = item?.startTime
    ? `${fmt(item.startTime)}${item.endTime ? ` – ${fmt(item.endTime)}` : ''}`
    : null;
  const dest = item ? { name: item.title, address, coords: item.place?.coords } : null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item?.title ?? ''}
      description={dayLabel}
      autoFocusInput={false}
      headerAside={
        item && canReview ? (
          /* 이름 오른쪽: 후기 입력만 (docs/20 U1) */
          <Button
            size="sm"
            variant={mine ? 'ghost' : 'secondary'}
            leading={<SquarePen aria-hidden="true" className="size-4" />}
            onClick={() => (visited ? setReviewOpen(true) : toast(t('review.notVisited')))}
          >
            {mine ? t('review.mine') : t('review.write')}
          </Button>
        ) : undefined
      }
    >
      {item && Icon && dest && (
        <div className="flex flex-col gap-5">
          {/* 첫 줄: 종류 · 방문 시간 (바로 고치기) */}
          <div className="tabular flex flex-wrap items-center gap-x-3 gap-y-2 text-body-2 text-fg-sub">
            <span className="flex items-center gap-1.5">
              <Icon aria-hidden="true" className="size-4" />
              {t(`kind.${item.kind}`)}
            </span>
            {onVisitTime && !readOnly ? (
              <label className="flex items-center gap-2">
                <span className="text-caption text-fg-muted">{t('detail.visitTime')}</span>
                <TimeInput
                  id="detail-visit-time"
                  size="sm"
                  label={t('detail.visitTime')}
                  value={item.startTime ?? ''}
                  onChange={onVisitTime}
                  className="w-[104px]"
                />
                {item.endTime && (
                  <span className="text-caption text-fg-muted">~ {fmt(item.endTime)}</span>
                )}
              </label>
            ) : (
              time && <span>{time}</span>
            )}
          </div>

          {booking && <BookingSummary booking={booking} onOpen={onOpenBooking} />}
          {/* 붙여 둔 이티켓·바우처 바로 열기 (입국 심사·체크인 때) */}
          {booking && <BookingDocs booking={booking} canEdit={false} compact />}

          {/* 누를 수 없는 버튼은 보이지 않게 — 종류·정보에 맞는 것만 (docs/16 D1) */}
          <div className="grid grid-cols-4 gap-2">
            {placeLike && (
              <Action
                icon={<Navigation />}
                label={t('detail.directions')}
                onClick={onDirections}
                primary
              />
            )}
            {address && (
              <Action
                icon={<Copy />}
                label={t('detail.copyAddress')}
                onClick={() => void copyAddress()}
              />
            )}
            {placeLike && hasPlace && (
              <Action
                icon={<MapPinned />}
                label={t('detail.viewOnMap')}
                onClick={() => openMapLink(placeLink(mapApp, dest, window.location.hostname))}
              />
            )}
            {!readOnly && <Action icon={<Pencil />} label={t('detail.edit')} onClick={onEdit} />}
          </div>

          <dl className="flex flex-col gap-3 text-body-2">
            {placeLike && (
              <Info label={t('form.address')}>
                {address ?? <span className="text-fg-muted">{t('detail.noAddress')}</span>}
              </Info>
            )}
            {item.memo && <Info label={t('form.memo')}>{item.memo}</Info>}
            {item.url && (
              <Info label={t('form.url')}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary"
                >
                  {t('detail.openLink')}
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              </Info>
            )}
          </dl>

          {reviewKind && <ItemReviews data={reviews} kind={reviewKind} />}

          {!readOnly && total > 1 && (
            <div className="flex items-center gap-2 rounded-card bg-bg-subtle py-1 pr-1 pl-4">
              <span className="flex-1 text-body-2 font-medium">
                {t('detail.order')}
                <span className="tabular ml-2 text-caption text-fg-muted" aria-live="polite">
                  {t('detail.position', { n: position, total })}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={position <= 1}
                onClick={onMoveUp}
                leading={<ArrowUp aria-hidden="true" className="size-4" />}
              >
                {t('detail.moveUp')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={position >= total}
                onClick={onMoveDown}
                leading={<ArrowDown aria-hidden="true" className="size-4" />}
              >
                {t('detail.moveDown')}
              </Button>
            </div>
          )}

          {!readOnly && showDone && (
            <div className="flex items-center justify-between rounded-card bg-bg-subtle px-4 py-3">
              <label htmlFor="item-done" className="text-body-2 font-medium">
                {t('detail.done')}
              </label>
              <Switch id="item-done" checked={item.done ?? false} onCheckedChange={onToggleDone} />
            </div>
          )}

          {!readOnly && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                leading={<CalendarArrowUp aria-hidden="true" className="size-4" />}
                onClick={onMoveDay}
              >
                {t('detail.moveDay')}
              </Button>
              <Button
                variant="secondary"
                className="text-danger"
                leading={<Trash2 aria-hidden="true" className="size-4" />}
                onClick={onDelete}
              >
                {t('detail.delete')}
              </Button>
            </div>
          )}
        </div>
      )}
      {item && reviewKind && tripId && reviewOpen && (
        <Suspense fallback={null}>
          <ReviewSheet
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            tripId={tripId}
            item={item}
            kind={reviewKind}
            domestic={domestic}
            near={near}
            existing={mine}
            onSaved={() => setReviewVersion((v) => v + 1)}
          />
        </Suspense>
      )}
    </BottomSheet>
  );
}

function Action({
  icon,
  label,
  onClick,
  primary = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 rounded-btn py-2 text-micro text-fg-sub disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={`grid size-11 place-items-center rounded-full [&>svg]:size-5 ${primary ? 'bg-primary text-on-primary' : 'bg-bg-subtle text-fg'}`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
      <dd className="m-0 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

/** 연결된 예약 요약: 시간·장소·터미널·좌석, 예약번호 복사, 예약 보기 (docs/16 D2) */
function BookingSummary({
  booking: b,
  onOpen,
}: {
  booking: Booking;
  onOpen?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const { time } = useTimeText();
  const route =
    b.kind === 'flight' || b.kind === 'train'
      ? [b.start.place, b.end?.place].filter(Boolean).join(' → ')
      : undefined;
  const when = [time(b.start.time), b.end?.time ? time(b.end.time) : undefined]
    .filter(Boolean)
    .join(' – ');
  const extra = [
    b.details?.terminal && t('detail.departTerminal', { t: b.details.terminal }),
    b.details?.arrivalTerminal && t('detail.arriveTerminal', { t: b.details.arrivalTerminal }),
    b.details?.seat && t('bookings.seatValue', { seat: b.details.seat }),
  ].filter(Boolean);
  return (
    <section
      aria-label={t('detail.booking')}
      className="flex flex-col gap-1.5 rounded-card border border-line bg-bg-subtle/60 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-bold text-fg-muted">{t(`bookingKind.${b.kind}`)}</span>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="text-caption font-semibold text-primary"
          >
            {t('detail.openBooking')}
          </button>
        )}
      </div>
      {b.kind === 'flight' ? (
        <FlightTicket booking={b} />
      ) : (
        <>
          <p className="text-body-2 font-semibold">
            {route ?? b.title}
            {when && <span className="tabular ml-2 font-normal text-fg-sub">{when}</span>}
          </p>
          {extra.length > 0 && <p className="text-caption text-fg-sub">{extra.join(' · ')}</p>}
        </>
      )}
      {b.confirmationNo && (
        <button
          type="button"
          onClick={() => void copyText(b.confirmationNo!, t('bookings.copied'))}
          aria-label={t('bookings.copyNo', { no: b.confirmationNo })}
          className="self-start rounded-btn bg-surface px-2 py-1 font-mono text-caption"
        >
          {t('detail.confirmationNo', { no: b.confirmationNo })} ⧉
        </button>
      )}
    </section>
  );
}
