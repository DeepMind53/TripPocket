import { InlineIcon } from '../../shared/ui/InlineIcon';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { type Booking, type ItineraryItem } from '@trippocket/shared';
import { Check, StickyNote } from 'lucide-react';
import { type Visit } from '../../domain/visit';
import { VisitToggle } from '../common/VisitToggle';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { KIND_ICON } from './itemKinds';
import { FlightTicket, TrainTicket } from '../bookings/BookingCard';
import { type WeatherCaution } from '../../domain/weather';
import { CautionIcons } from '../common/CautionIcons';
import { routeStyle } from '../../shared/ui';

export function ItemRow({
  item,
  n,
  dayIndex,
  past = false,
  now,
  booking,
  onOpen,
  onVisit,
  onConfirmFlight,
  history,
  cautions,
}: {
  item: ItineraryItem;
  n: number;
  /** 날씨 주의 (설정 "일정"): 시간 아래 작은 선 그림 — 여러 개면 모두 (사용자 요청 2026-10-28) */
  cautions?: readonly WeatherCaution[] | undefined;

  /** 일차 번호(0부터) — 노선 색. null이면 회색·노선 없음 (가고 싶은 곳) */
  dayIndex: number | null;
  /** 지난 일정 — 아래 노선 토막과 점을 흐리게 */
  past?: boolean;
  /** 여행 당일 지금 진행 중: 노선 점 채움·고리 + 진한 테두리 (깜빡임 없음 — 사용자 결정 2026-11-10, 전에는 2026-10-26 깜빡임) */
  now: boolean;
  /** 아직 방문 기록이 없는 지난 일정: 오른쪽에 [방문][미방문] — 누르면 둘 다 사라진다 (2026-10-27) */
  onVisit?: ((visit: Visit | null) => void) | undefined;
  /** 예전에 이 장소를 방문한 날 (다른 여행 포함) — 이름 오른쪽 "방문기록 N회" */
  history?: readonly { date: string; trip: string }[] | undefined;
  /** 출발 전날~출발 날 항공편: 위에 [확인], 누르기 전까지 빨갛게 깜빡임 (사용자 요청 2026-10-26) */
  onConfirmFlight?: (() => void) | undefined;
  /** 예약에서 넘어온 일정이면 그 예약: 점선 테두리로 구분 (사용자 요청 2026-10-26) */
  booking?: Booking | undefined;
  onOpen: () => void;
}) {
  const { time, wide } = useTimeText();
  const { t } = useTranslation();
  const Icon = KIND_ICON[item.kind];
  const label =
    t('plan.itemLabel', {
      n,
      title: item.kind === 'note' ? (item.memo ?? item.title) : item.title,
    }) + (item.visit ? `, ${t(`visit.record.${item.visit}`)}` : '');
  // 미방문으로 남긴 일정: 회색 바탕에 옅은 빗금 + 가운데 큰 글씨 (styles/index.css .visit-mark).
  // 방문은 그대로 둔다 (번호 자리에 ✓, 사용자 요청 2026-10-27)
  const marked = item.visit === 'skipped';
  const [showHistory, setShowHistory] = useState(false);
  const visitedLook = item.visit === 'visited';
  const wrap = (row: ReactNode) => (
    <li className="relative flex flex-col gap-1">
      {onConfirmFlight && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-btn bg-danger/10 px-3 py-2 text-caption text-danger"
        >
          <span className="flex-1 whitespace-pre-line">{t('flightCheck.notice')}</span>
          <button
            type="button"
            onClick={onConfirmFlight}
            className="h-8 shrink-0 rounded-full bg-primary px-4 text-caption font-semibold text-on-primary"
          >
            {t('flightCheck.confirm')}
          </button>
        </div>
      )}
      <div className="flex items-stretch gap-1.5">
        {/* 방문·미방문 버튼(세로 2개) 높이만큼 일정 줄도 늘어난다 (사용자 요청 2026-10-27) */}
        <div className="relative flex min-w-0 flex-1 [&>[data-item-row]]:h-auto">
          {row}
          {marked && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid place-items-center text-title-2 font-semibold text-fg-sub"
            >
              {t('visit.record.skipped')}
            </span>
          )}
        </div>
        {onVisit && (
          <VisitToggle vertical value={item.visit} label={item.title} onChange={onVisit} />
        )}
      </div>
      {showHistory && history && history.length > 0 && (
        <ul
          aria-label={t('visit.historyTitle')}
          className="ml-9 flex flex-col gap-0.5 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub"
        >
          {history.map((h) => (
            <li key={h.date + h.trip} className="tabular">
              {t('visit.historyRow', { date: h.date.slice(2).replace(/-/g, '.'), trip: h.trip })}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
  // 노선 역 점 (docs/29 §4.1): 흰 바탕 + 노선 색 테두리 + 진한 노선 색 번호, 진행 중이면 채움 + 바깥 고리.
  // 메모는 둥근 네모 (정류장 아님), 지난 일정은 옅은 색. 점은 불투명 — 그날 선(DaySection ol)을 덮는다 (2026-11-10)
  const badge = (
    <span
      aria-hidden="true"
      data-route-dot=""
      {...(past && !now ? { 'data-route-past': '' } : {})}
      className={cn(
        'relative z-[1] grid size-6 shrink-0 place-items-center border-[3px] font-mono text-micro leading-none',
        item.kind === 'note' ? 'rounded-chip border-2' : 'rounded-full',
        now
          ? 'border-[var(--route-ink)] bg-[var(--route-ink)] text-on-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--route)_22%,transparent)]'
          : past
            ? 'border-[color-mix(in_srgb,var(--route)_40%,var(--tp-surface))] bg-surface text-fg-muted'
            : 'border-[var(--route)] bg-surface text-[var(--route-ink)]',
      )}
    >
      {item.done ? <Check className="size-3" strokeWidth={3} /> : n}
    </span>
  );
  // 종류 색은 줄 바탕 대신 종류 아이콘 칸에 (사용자 결정 2026-11-10, 전에는 줄 전체 파스텔 2026-10-26)
  const kindStyle = {
    '--kind': `var(--tp-kind-${item.kind})`,
    ...routeStyle(dayIndex),
  } as CSSProperties;
  // 진행 중: 깜빡임 없이 노선 색 옅은 바탕 + 진한 테두리
  const nowLook =
    'bg-[color-mix(in_srgb,var(--route)_8%,var(--tp-surface))] shadow-[inset_0_0_0_2px_var(--route-ink)]';
  // 항공편 출발 일정은 예약 탭과 같은 탑승권 모양 그대로 (도착 공항 일정은 아래 보통 줄)
  // 기차·버스도 예약 탭과 같은 표 모양 (사용자 요청 2026-11-03 — "비행기표처럼")
  if ((booking?.kind === 'flight' || booking?.kind === 'train') && item.transport)
    return wrap(
      <button
        type="button"
        data-item-row=""
        data-from-booking=""
        onClick={onOpen}
        aria-label={label}
        aria-current={now ? 'time' : undefined}
        style={kindStyle}
        className={cn(
          'flex w-full items-start gap-3 rounded-btn border border-dashed border-fg-muted/60 px-3 py-3 text-left active:bg-bg-subtle',
          item.done && !marked && !visitedLook && 'opacity-50',
          now && `${nowLook} border-transparent font-semibold`,
          marked && 'visit-mark',
          onConfirmFlight && 'flight-alert border-transparent',
        )}
      >
        {badge}
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          {booking.kind === 'train' ? (
            <TrainTicket booking={booking} />
          ) : (
            <FlightTicket booking={booking} />
          )}
          {/* 탑승권 줄에는 날씨 주의 표시를 넣지 않는다 (사용자 요청 2026-11-10) */}
          {booking.confirmationNo && (
            <span className="tabular border-t border-dashed border-line pt-1.5 text-caption text-fg-sub">
              {t('bookings.confirmationNo')}{' '}
              <strong className="font-semibold text-fg">{booking.confirmationNo}</strong>
            </span>
          )}
        </span>
      </button>,
    );
  return wrap(
    <button
      type="button"
      data-item-row=""
      {...(booking ? { 'data-from-booking': '' } : {})}
      onClick={onOpen}
      aria-label={label}
      aria-current={now ? 'time' : undefined}
      style={kindStyle}
      className={cn(
        'flex w-full items-start gap-3 rounded-btn px-3 py-3 text-left active:bg-bg-subtle',
        booking && 'border border-dashed border-fg-muted/60',
        now && `${nowLook} border-transparent`,
        marked && 'visit-mark',
      )}
    >
      {/* unslop(2026-11-09): 번호 · 제목(아래 종류·경로·주소·메모) · 오른쪽 시간. 시간·종류가 제목 폭을 덜 먹어 긴 이름도 덜 접힌다 */}
      {badge}
      <span
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5',
          item.done && !visitedLook && 'opacity-50',
        )}
      >
        {item.kind === 'note' ? (
          <span
            className={cn(
              'line-clamp-4 text-body-2',
              item.done && 'line-through',
              now && 'font-semibold',
            )}
          >
            {item.memo ?? item.title}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2">
            <span
              className={cn(
                'text-body-1 text-pretty',
                item.done && !visitedLook && 'line-through',
                now && 'font-semibold',
              )}
            >
              {item.title}
              {/* 공항 픽업·드랍은 예약처를 제목 옆에 (사용자 요청 2026-10-27) */}
              {booking?.kind === 'transfer' && booking.provider && (
                <span className="text-body-2 font-normal text-fg-sub"> ({booking.provider})</span>
              )}
            </span>
            {history && history.length > 0 && (
              // 줄 전체가 버튼이라 안쪽은 span — 누르면 방문한 날짜만 펼치고 상세는 열지 않는다
              <span
                role="button"
                tabIndex={0}
                aria-expanded={showHistory}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHistory(!showHistory);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  e.stopPropagation();
                  setShowHistory(!showHistory);
                }}
                className="rounded-full bg-primary-weak px-2 py-0.5 text-micro font-semibold text-primary"
              >
                {t('visit.historyCount', { n: history.length })}
              </span>
            )}
          </span>
        )}
        {/* 종류 + 경로/주소 한 줄 (예전 오른쪽 종류 칩) */}
        <span className="flex min-w-0 items-center gap-1.5 text-caption text-fg-muted">
          {/* 종류 아이콘 칸: 종류 색 옅은 바탕 + 종류 색 아이콘 */}
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center rounded-chip bg-[color-mix(in_srgb,var(--kind)_16%,var(--tp-surface))] text-[var(--kind)]"
          >
            <Icon className="size-3.5" />
          </span>
          <span className="shrink-0">{t(`kind.${item.kind}`)}</span>
          {item.transport && (item.transport.from || item.transport.to) ? (
            <span className="tabular truncate">
              {' · '}
              {item.transport.from ?? ''} → {item.transport.to ?? ''}
            </span>
          ) : (
            item.kind !== 'note' &&
            item.place?.address && <span className="truncate"> · {item.place.address}</span>
          )}
        </span>
        {/* 메모가 있으면 첫 줄만 (사용자 요청 2026-10-27) */}
        {item.kind !== 'note' && item.memo?.trim() && (
          <span className="truncate text-caption text-fg-sub">
            <InlineIcon icon={StickyNote} className="text-fg-muted" />
            {item.memo.trim().split(/\r?\n/)[0]}
          </span>
        )}
      </span>
      <span
        className={cn(
          'tabular flex shrink-0 flex-col items-end text-body-2 leading-6',
          now ? 'font-semibold text-fg' : 'text-fg-sub',
          wide ? 'min-w-16' : 'min-w-11',
        )}
      >
        {time(item.startTime) ?? ''}
        <CautionIcons cautions={cautions} />
      </span>
    </button>,
  );
}
