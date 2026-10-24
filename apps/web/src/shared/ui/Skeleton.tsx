import { useTranslation } from '../../i18n';

/**
 * 불러오는 짧은 순간 빈 화면 대신 회색 줄 (docs/16 F3). CSS만 — 움직임은 "동작 줄이기" 설정을 따른다
 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3 px-5 pt-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl border border-line p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-bg-subtle motion-reduce:animate-none" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-bg-subtle motion-reduce:animate-none" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-bg-subtle motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
