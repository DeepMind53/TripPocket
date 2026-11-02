import { ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import {
  TRANSIT_GUIDE_CHECKED_AT,
  transitGuideFor,
  type TransitModeKind,
} from '../../data/transitGuide';
import { useTranslation } from '../../i18n';

const ICON: Record<TransitModeKind, string> = {
  metro: '🚇',
  bus: '🚌',
  coach: '🚍',
  rail: '🚆',
  tram: '🚋',
  ferry: '⛴️',
  bike: '🚲',
  taxi: '🚕',
};

/**
 * 실험실 "대중교통 안내" (사용자 요청 2026-11-03): 나라별 교통수단·대표 요금·환승·추천 앱·공식 안내.
 * 처음엔 접어 두고 눌러서 펼친다 (빠른 메뉴가 길어지지 않게)
 */
export function TransitGuide({ country, label }: { country: string; label: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const g = transitGuideFor(country);
  if (!g) return null;
  return (
    <div className="flex flex-col rounded-card bg-bg-subtle px-3 py-1 text-caption text-fg-sub">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 items-center gap-1.5 text-left font-semibold text-fg"
      >
        <span className="flex-1">{t('transitGuide.title', { country: label })}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-2">
          <ul className="flex flex-col gap-1">
            {g.modes.map((m) => (
              <li key={m.name} className="flex items-start gap-1.5">
                <span aria-hidden="true">{ICON[m.kind]}</span>
                <span className="min-w-0 flex-1">{m.name}</span>
                {m.fare && <span className="tabular shrink-0 text-fg">{m.fare}</span>}
              </li>
            ))}
          </ul>
          <p className="flex flex-col">
            <span className="font-semibold text-fg">{t('transitGuide.transfer')}</span>
            <span className="whitespace-pre-line">{g.transfer}</span>
          </p>
          {g.note && <p className="whitespace-pre-line text-warning">{g.note}</p>}
          <p className="flex flex-col">
            <span className="font-semibold text-fg">{t('transitGuide.apps')}</span>
            {g.apps.join(' · ')}
          </p>
          <p className="text-micro whitespace-pre-line text-fg-muted">
            {t('transitGuide.checked', { date: TRANSIT_GUIDE_CHECKED_AT })}
          </p>
          <a
            href={g.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center gap-1 font-semibold text-primary"
          >
            {t('transitGuide.official')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
