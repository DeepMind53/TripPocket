import { type LocalDate } from '@trippocket/shared';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { RollingSlot, routeColor } from '../../shared/ui';

/**
 * "N일차" 알약 ↔ 날짜를 한 칸에서 3초마다 번갈아 (사용자 요청 2026-11-18).
 * 칸 폭은 날짜(더 긴 쪽)에 맞춰 고정하고 알약도 그 폭을 채운다 — 옆 버튼·날씨가 흔들리지 않게 (2026-11-23).
 * 일정 있는 날 머리(DaySection)와 빈 날 줄(EmptyDayRow)이 같은 크기로 함께 쓴다 (사용자 요청 2026-11-23)
 */
export function DayRoll({ date, index }: { date: LocalDate; index: number }) {
  const { t } = useTranslation();
  // 일차 알약은 진한 노선 색 + on-primary 글자 (8색 모두 4.5:1, docs/29 §3.1)
  const dayInk = routeColor(index).ink;
  return (
    <RollingSlot
      reserve
      items={[
        <span
          key="day"
          className="w-full rounded-full px-2.5 py-0.5 text-center text-caption font-semibold whitespace-nowrap text-on-primary"
          style={{ background: dayInk }}
        >
          {t('plan.dayN', { n: index + 1 })}
        </span>,
        <span key="date" className="text-body-1 font-semibold whitespace-nowrap">
          {formatMonthDay(date)}
        </span>,
      ]}
    />
  );
}
