import { diffDays, ESSENTIALS_CHECKED_AT, flagEmoji, todayIn } from '@trippocket/shared';
import { Check, ExternalLink, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useTrip } from '../../data/hooks';
import { setPassportExpiry, usePassportExpiry } from '../../data/passportExpiry';
import { checklistRepo } from '../../data/repositories/checklistRepo';
import { useCanEdit } from '../../data/tripRoles';
import { COMMON_KEY, isCheckable, type EssentialRow } from '../../domain/essentials';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { EmptyState, TopBar } from '../../shared/ui';
import { useEssentials } from './useEssentials';

/** 정보가 이만큼 오래되면 "공식 사이트에서 확인" 안내 */
const STALE_DAYS = 180;

/**
 * 나라별 필수 항목 체크리스트 (docs/19, 사용자 요청 2026-10-25).
 * 공식 사이트에서 확인한 내용 + 확인 날짜·출처. 체크는 여행 멤버와 동기화, 여권 만료일은 이 기기에만
 */
export function EssentialsPage() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const s = useEssentials(trip ?? undefined);
  const canEdit = useCanEdit(tripId);
  const stale = diffDays(ESSENTIALS_CHECKED_AT, todayIn(trip?.timezone)) > STALE_DAYS;

  if (!trip || !s) return <TopBar title={t('essentials.title')} backTo="/" />;
  return (
    <>
      <TopBar
        title={t('essentials.title')}
        subtitle={trip.title}
        backTo={`/trips/${trip.id}/plan`}
      />
      <div className="flex flex-col gap-5 px-5 pt-2 pb-8">
        <p className="text-caption whitespace-pre-line text-fg-muted">
          {t('essentials.intro', { date: ESSENTIALS_CHECKED_AT })}
        </p>
        {stale && (
          <p role="alert" className="rounded-card bg-warning/10 px-3 py-2 text-caption text-fg-sub">
            {t('essentials.stale')}
          </p>
        )}
        {s.groups.length === 0 ? (
          <EmptyState
            emoji="🛂"
            title={t('essentials.domesticTitle')}
            description={t('essentials.domesticDesc')}
          />
        ) : (
          <>
            <p className="tabular text-body-2 font-semibold">
              {t('essentials.progress', { done: s.done, total: s.total })}
            </p>
            {s.unknown.length > 0 && (
              <p className="text-caption text-fg-sub">
                {t('essentials.unknown', { codes: s.unknown.map(flagEmoji).join(' ') })}{' '}
                <a
                  href="https://www.0404.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary"
                >
                  {t('essentials.mofa')}
                </a>
              </p>
            )}
            {s.groups.map((g) => (
              <section
                key={g.code}
                aria-label={g.country?.name ?? t('essentials.common')}
                className="flex flex-col gap-2"
              >
                <h2 className="flex items-center gap-2 text-body-1 font-bold">
                  {g.country ? `${flagEmoji(g.code)} ${g.country.name}` : t('essentials.common')}
                </h2>
                {(['must', 'recommend', 'tip'] as const).map((level) => {
                  const rows = g.rows.filter((r) => r.item.level === level);
                  if (rows.length === 0) return null;
                  return (
                    <div key={level} className="flex flex-col gap-1">
                      <h3 className="px-1 text-caption font-bold text-fg-muted">
                        {t(`essentials.level.${level}`)}
                      </h3>
                      <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                        {rows.map((r) => (
                          <EssentialLine key={r.key} row={r} tripId={trip.id} canEdit={canEdit} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {g.country && (
                  <details className="px-1 text-caption text-fg-muted">
                    <summary className="cursor-pointer">
                      {t('essentials.sources', { date: ESSENTIALS_CHECKED_AT })}
                    </summary>
                    <ul className="mt-1 flex flex-col gap-1">
                      {g.country.sources.map((src) => (
                        <li key={src.url}>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary"
                          >
                            {src.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            ))}
            <p className="text-micro whitespace-pre-line text-fg-muted">
              {t('essentials.disclaimer')}
            </p>
          </>
        )}
      </div>
    </>
  );
}

function EssentialLine({
  row,
  tripId,
  canEdit,
}: {
  row: EssentialRow;
  tripId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const { item } = row;
  const checkable = isCheckable(item);
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      {checkable ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={row.checked}
          aria-label={item.title}
          disabled={row.auto || !canEdit}
          onClick={() => void checklistRepo.setEssential(tripId, row.key, !row.checked)}
          // 보이는 칸은 24px, 누르는 영역은 44px (docs/20 U7)
          className="-my-2.5 -ml-2.5 grid size-11 shrink-0 place-items-center"
        >
          <span
            className={cn(
              'grid size-6 place-items-center rounded-md border-2',
              row.checked ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface',
            )}
          >
            {row.checked && <Check aria-hidden="true" className="size-4" strokeWidth={3} />}
          </span>
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-6 shrink-0 place-items-center text-fg-muted"
        >
          ·
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn('text-body-2 font-semibold', row.checked && checkable && 'text-fg-sub')}
        >
          {item.title}
          {row.auto && (
            <span className="ml-1.5 rounded bg-success/15 px-1.5 py-0.5 text-micro font-semibold text-success">
              {t('essentials.auto')}
            </span>
          )}
          {row.due && (
            <span className="ml-1.5 rounded bg-warning/15 px-1.5 py-0.5 text-micro font-semibold text-warning">
              {t('essentials.dueNow')}
            </span>
          )}
        </span>
        <span className="text-caption whitespace-pre-line text-fg-sub">{item.desc}</span>
        {item.fromDaysBefore !== undefined && (
          <span className="text-micro text-fg-muted">
            {t('essentials.fromDays', { n: item.fromDaysBefore })}
          </span>
        )}
        {row.note && <span className="text-caption text-success">{row.note}</span>}
        {row.warn && (
          <span
            role="alert"
            className="flex items-center gap-1 text-caption font-semibold text-warning"
          >
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            {row.warn}
          </span>
        )}
        {item.id === 'passport' && <PassportInput />}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 self-start text-caption font-semibold text-primary"
          >
            {t(
              row.key.startsWith(`${COMMON_KEY}:`) ? 'essentials.open' : 'essentials.openOfficial',
            )}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
      </span>
    </li>
  );
}

/** 여권 만료일 — 이 기기에만 저장 */
function PassportInput() {
  const { t } = useTranslation();
  const value = usePassportExpiry((s) => s.value);
  const [open, setOpen] = useState(false);
  if (!value && !open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-caption font-semibold text-primary"
      >
        {t('essentials.passportAdd')}
      </button>
    );
  return (
    <label className="mt-1 flex flex-col gap-1 text-caption text-fg-sub">
      {t('essentials.passportLabel')}
      <input
        type="date"
        aria-label={t('essentials.passportLabel')}
        value={value ?? ''}
        onChange={(e) => setPassportExpiry(e.target.value || null)}
        className="h-10 w-44 rounded-btn border border-line bg-bg-subtle px-2 text-body-2"
      />
      <span className="text-micro text-fg-muted">{t('essentials.passportPrivacy')}</span>
    </label>
  );
}
