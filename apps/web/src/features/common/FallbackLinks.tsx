import { ExternalLink } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { openFallback, type FallbackLink } from '../../shared/lib/fallbackLinks';

/** "네이버 지도에서 보기" 같은 대신 열기 버튼들 (API 한도일 때, shared/lib/fallbackLinks.ts) */
export function FallbackLinks({
  links,
  className,
}: {
  links: readonly FallbackLink[];
  className?: string;
}) {
  const { t } = useTranslation();
  if (links.length === 0) return null;
  return (
    <span className={cn('flex flex-wrap gap-1.5', className)}>
      {links.map((l) => (
        <button
          key={l.url}
          type="button"
          onClick={() => openFallback(l)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-caption font-semibold text-primary"
        >
          {t(`fallback.${l.id}`)}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </button>
      ))}
    </span>
  );
}
