import type { ItineraryItem } from '@trippocket/shared';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

type Visit = NonNullable<ItineraryItem['visit']>;

/**
 * 지난 일정 오른쪽 [미방문] [방문] (사용자 요청 2026-11-06): 고른 것 하나만 칠해지고 버튼은 늘 남는다.
 * 같은 것을 다시 누르면 고른 것을 지운다. 홈·일정·여행 모드에서 같은 모양·같은 기록
 */
export function VisitToggle({
  value,
  onChange,
  vertical = false,
  label,
}: {
  value: Visit | undefined;
  onChange: (visit: Visit | null) => void;
  /** 일정 목록처럼 좁은 줄: 위아래로 */
  vertical?: boolean;
  /** 어느 일정인지 (스크린리더) */
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('visit.groupLabel', { name: label })}
      className={cn(
        'flex shrink-0 gap-1',
        vertical ? 'w-16 flex-col justify-center' : 'items-center',
      )}
    >
      {(['skipped', 'visited'] as const).map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={(e) => {
              e.stopPropagation();
              onChange(on ? null : v);
            }}
            className={cn(
              'rounded-btn border text-caption font-semibold',
              vertical ? 'h-9' : 'h-9 px-2.5',
              on
                ? v === 'visited'
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-fg-muted bg-fg-muted text-surface'
                : 'border-line bg-surface text-fg-sub',
            )}
          >
            {t(`visit.button.${v}`)}
          </button>
        );
      })}
    </div>
  );
}
