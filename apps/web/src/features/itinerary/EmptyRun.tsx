import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { type Section } from './planSections';

/** 이어진 빈 날 묶음: "3~5일차 일정 없음" — 누르면 펼침 */
export function EmptyRun({ from, to, onOpen }: { from: Section; to: Section; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      data-day={from.date!}
      className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-dashed border-line px-4 text-left"
    >
      {/* 첫 줄 일차·일정 없음, 둘째 줄 날짜 범위 (2026-11-14 다듬기 — "없음"만 줄바꿈되던 것) */}
      <span className="flex min-w-0 flex-col py-2">
        <span className="tabular text-body-2 font-semibold">
          {t('plan.emptyRun', { from: from.index + 1, to: to.index + 1 })}
        </span>
        <span className="tabular text-caption text-fg-muted">
          {formatMonthDay(from.date!)} – {formatMonthDay(to.date!)}
        </span>
      </span>
      <span className="text-caption whitespace-nowrap text-primary">{t('plan.showDays')}</span>
    </button>
  );
}
