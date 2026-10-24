import { Star } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/** 별 1~5 고르기 — 같은 별을 다시 누르면 지움 (선택 항목) */
export function StarPicker({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('review.starGroup', { aspect: label })}
      className="flex items-center gap-2"
    >
      <span className="w-20 shrink-0 text-body-2">
        {label}
        {required && <span className="ml-1 text-micro text-fg-muted">{t('review.required')}</span>}
      </span>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t('review.star', { aspect: label, n })}
            aria-pressed={value === n}
            onClick={() => onChange(value === n && !required ? undefined : n)}
            className="grid size-11 place-items-center"
          >
            <Star
              aria-hidden="true"
              className={cn(
                'size-6',
                value && n <= value ? 'fill-warning text-warning' : 'text-line',
              )}
            />
          </button>
        ))}
      </span>
    </div>
  );
}

/** 읽기 전용 별 (소수는 반올림해서 채움) */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'size-3.5',
            n <= Math.round(value) ? 'fill-warning text-warning' : 'text-line',
          )}
        />
      ))}
    </span>
  );
}
