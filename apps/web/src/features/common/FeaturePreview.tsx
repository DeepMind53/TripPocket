import { Footprints, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import type { PreviewId } from './previewIds';

/**
 * 켜면 어떻게 보이는지 [샘플] 미리보기 (사용자 요청 2026-10-27 — 실험실·설정 "일정").
 * 실제 일정 화면 모양을 본뜬 그림 — 샘플 이름은 그림용 예시라 문구 키 대신 그대로 둔다 (소개 카드와 같은 방식)
 */
export function FeaturePreview({ id }: { id: PreviewId }) {
  const { t } = useTranslation();
  const day = (children: ReactNode, opts: { gap?: string; dim?: boolean } = {}) => (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-line bg-surface',
        opts.dim && 'opacity-60',
      )}
    >
      <div
        className="flex min-h-10 items-center gap-2 border-b border-line bg-bg-subtle/60 pl-4"
        style={{ boxShadow: 'inset 4px 0 0 #2F6BFF' }}
      >
        <span className="rounded-full bg-[#2F6BFF] px-2.5 py-0.5 text-caption font-bold text-white">
          {t('plan.dayN', { n: 2 })}
        </span>
        <span className="text-body-2 font-bold">10.28 (수)</span>
      </div>
      <div className={cn('flex flex-col p-3', opts.gap ?? 'gap-1.5')}>{children}</div>
    </div>
  );
  const row = (
    n: number,
    time: string,
    title: string,
    opts: { now?: boolean; done?: boolean; tight?: boolean } = {},
  ) => (
    <div
      className={cn(
        'flex items-center gap-2 rounded-btn bg-bg-subtle px-2 text-body-2',
        opts.tight ? 'py-1' : 'py-2',
        opts.now && 'font-bold ring-2 ring-primary',
      )}
    >
      <span className="grid size-6 place-items-center rounded-full bg-[#2F6BFF] text-micro font-bold text-white">
        {opts.done ? '✓' : n}
      </span>
      <span className="tabular w-11 text-caption text-fg-sub">{time}</span>
      <span className="flex-1">{title}</span>
    </div>
  );
  const sunLine = (kind: 'rise' | 'set', time: string) => {
    const icon =
      kind === 'rise' ? (
        <Sun aria-hidden="true" className="size-3.5 text-warning" />
      ) : (
        <Moon aria-hidden="true" className="size-3.5 text-primary" />
      );
    return (
      <div className="tabular flex items-center gap-1.5 text-micro text-fg-muted">
        <span aria-hidden="true" className="flex-1 overflow-hidden whitespace-nowrap text-right">
          {'-'.repeat(60)}
        </span>
        {icon}
        {t(kind === 'rise' ? 'plan.sunrise' : 'plan.sunset')} {time}
        {icon}
        <span aria-hidden="true" className="flex-1 overflow-hidden whitespace-nowrap">
          {'-'.repeat(60)}
        </span>
      </div>
    );
  };

  switch (id) {
    case 'dimPastItems':
      return (
        <div className="flex flex-col gap-2">
          {day(<>{row(1, '10:00', '센소지', { done: true })}</>, { dim: true })}
          <p className="text-center text-caption text-fg-muted">{t('preview.dimPast')}</p>
        </div>
      );
    case 'planMapOpen':
      return (
        <div className="flex flex-col gap-2">
          <div className="grid h-24 place-items-center rounded-2xl bg-[#E8F0E6] text-caption text-fg-sub dark:bg-[#1f2a22]">
            🗺 1 · 2 · 3
          </div>
          {day(<>{row(1, '10:00', '센소지')}</>)}
        </div>
      );
    case 'sunTimes':
      return day(
        <>
          {sunLine('rise', '06:12')}
          {row(1, '10:00', '센소지')}
          {row(2, '13:00', '스카이트리')}
          {sunLine('set', '17:40')}
          {row(3, '18:30', '이치란 라멘')}
        </>,
      );
    case 'legDistance':
      return day(
        <>
          {row(1, '10:00', '센소지')}
          <p className="flex items-center gap-1.5 pl-9 text-micro text-fg-muted">
            <Footprints aria-hidden="true" className="size-3" />
            {t('labs.leg', { distance: '1.3km', min: 17 })}
          </p>
          {row(2, '13:00', '스카이트리')}
        </>,
      );
    case 'compactList':
      return day(
        <>
          {row(1, '10:00', '센소지', { tight: true })}
          {row(2, '13:00', '스카이트리', { tight: true })}
          {row(3, '15:00', '아메요코 시장', { tight: true })}
          {row(4, '18:30', '이치란 라멘', { tight: true })}
        </>,
        { gap: 'gap-0.5' },
      );
    case 'nearbyWish':
      return day(
        <>
          <p className="rounded-btn bg-primary-weak px-3 py-2 text-caption text-primary">
            {t('labs.nearbyWish', { names: '아사쿠사 멘치, 사루타히코 커피', more: '' })}
          </p>
          {row(1, '10:00', '센소지')}
          {row(2, '13:00', '스카이트리')}
        </>,
      );
    case 'checkoutNotice':
      return day(
        <>
          <p className="flex items-center gap-2 rounded-btn bg-warning/10 px-3 py-2 text-caption text-fg-sub">
            <span aria-hidden="true">🧳</span>
            {t('labs.checkoutAt', { time: '11:00', name: '신주쿠 호텔' })}
          </p>
          {row(1, '09:00', '호텔 조식')}
          {row(2, '12:00', '츠키지 장외시장')}
        </>,
      );
    case 'dayRecap':
      return day(
        <>
          {row(1, '10:00', '센소지', { done: true })}
          {row(2, '13:00', '스카이트리', { done: true })}
          {row(3, '18:00', '이치란 라멘', { done: true })}
          <p className="rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
            {t('labs.recap', { n: 3, km: 6.4 })}
          </p>
        </>,
      );
    case 'nowScroll':
      return day(
        <>
          {row(1, '10:00', '센소지', { done: true })}
          {row(2, '13:00', '스카이트리', { now: true })}
          {row(3, '18:00', '이치란 라멘')}
          <p className="text-center text-caption text-fg-muted">{t('labs.previewNow')}</p>
        </>,
      );
  }
}
