import type { Trip } from '@trippocket/shared';
import { Link } from 'react-router';
import { useAllDayNotes } from '../../data/hooks';
import { useTranslation } from '../../i18n';

/**
 * 기록 탭 "하루 한 줄" (실험실 dayNote, 2026-11-10): 여행마다 날짜 순, 최근 여행 먼저. 누르면 그 여행 일정으로.
 * 내 기록만 (계정마다 따로, 2026-11-25)
 */
export function DayNoteLog({ trips }: { trips: readonly Trip[] }) {
  const { t } = useTranslation();
  const notes = useAllDayNotes() ?? [];
  const byTrip = (id: string) => notes.filter((n) => n.tripId === id);
  const withNotes = [...trips]
    .filter((tr) => byTrip(tr.id).length > 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (withNotes.length === 0) return null;
  return (
    <section aria-label={t('dayNote.logTitle')} className="flex flex-col gap-3">
      <h2 className="text-body-1 font-semibold">{t('dayNote.logTitle')}</h2>
      {withNotes.map((tr) => (
        <Link
          key={tr.id}
          to={`/trips/${tr.id}/plan`}
          className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4"
        >
          <span className="text-body-2 font-semibold">{tr.title}</span>
          <ul className="flex flex-col gap-1">
            {byTrip(tr.id).map((n) => (
              <li key={n.date} className="flex gap-3 text-body-2">
                <span className="tabular shrink-0 font-mono text-caption leading-6 text-fg-muted">
                  {n.date.slice(5).replace('-', '.')}
                </span>
                <span className="min-w-0 text-fg-sub">{n.text}</span>
              </li>
            ))}
          </ul>
        </Link>
      ))}
    </section>
  );
}
