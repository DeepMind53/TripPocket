import { Footprints, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import type { PreviewId } from './previewIds';

/**
 * 켜면 어떻게 보이는지 [샘플] 미리보기 (사용자 요청 2026-10-27 — 실험실·설정 "일정").
 * 실제 일정 화면 모양을 본뜬 그림 — 샘플 이름·날짜도 문구 키(sample.*)로
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
        <span className="text-body-2 font-bold">{t('sample.date')}</span>
      </div>
      <div className={cn('flex flex-col p-3', opts.gap ?? 'gap-1.5')}>{children}</div>
    </div>
  );
  const row = (
    n: number,
    time: string,
    title: string,
    opts: { now?: boolean; done?: boolean; tight?: boolean; home?: string; rain?: boolean } = {},
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
      <span className="tabular w-11 text-caption text-fg-sub">
        {time}
        {opts.home && (
          <span className="block text-micro text-fg-muted">
            {t('labs.homeTime', { time: opts.home })}
          </span>
        )}
      </span>
      <span className="flex-1">
        {opts.rain && '☔ '}
        {title}
      </span>
    </div>
  );
  const note = (text: string, tone = 'bg-bg-subtle text-fg-sub') => (
    <p className={cn('rounded-btn px-3 py-2 text-caption', tone)}>{text}</p>
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
          {day(<>{row(1, '10:00', t('sample.sensoji'), { done: true })}</>, { dim: true })}
          <p className="text-center text-caption text-fg-muted">{t('preview.dimPast')}</p>
        </div>
      );
    case 'planMapOpen':
      return (
        <div className="flex flex-col gap-2">
          <div className="grid h-24 place-items-center rounded-2xl bg-[#E8F0E6] text-caption text-fg-sub dark:bg-[#1f2a22]">
            🗺 1 · 2 · 3
          </div>
          {day(<>{row(1, '10:00', t('sample.sensoji'))}</>)}
        </div>
      );
    case 'sunTimes':
      return day(
        <>
          {sunLine('rise', '06:12')}
          {row(1, '10:00', t('sample.sensoji'))}
          {row(2, '13:00', t('sample.skytree'))}
          {sunLine('set', '17:40')}
          {row(3, '18:30', t('sample.ichiran'))}
        </>,
      );
    case 'legDistance':
      return day(
        <>
          {row(1, '10:00', t('sample.sensoji'))}
          <p className="flex items-center gap-1.5 pl-9 text-micro text-fg-muted">
            <Footprints aria-hidden="true" className="size-3" />
            {t('labs.leg', { distance: '1.3km', min: 17 })}
          </p>
          {row(2, '13:00', t('sample.skytree'))}
        </>,
      );
    case 'compactList':
      return day(
        <>
          {row(1, '10:00', t('sample.sensoji'), { tight: true })}
          {row(2, '13:00', t('sample.skytree'), { tight: true })}
          {row(3, '15:00', t('sample.ameyoko'), { tight: true })}
          {row(4, '18:30', t('sample.ichiran'), { tight: true })}
        </>,
        { gap: 'gap-0.5' },
      );
    case 'nearbyWish':
      return day(
        <>
          <p className="rounded-btn bg-primary-weak px-3 py-2 text-caption text-primary">
            {t('labs.nearbyWish', { names: t('sample.nearby'), more: '' })}
          </p>
          {row(1, '10:00', t('sample.sensoji'))}
          {row(2, '13:00', t('sample.skytree'))}
        </>,
      );
    case 'checkoutNotice':
      return day(
        <>
          <p className="flex items-center gap-2 rounded-btn bg-warning/10 px-3 py-2 text-caption text-fg-sub">
            <span aria-hidden="true">🧳</span>
            {t('labs.checkoutAt', { time: '11:00', name: t('sample.shinjukuHotel') })}
          </p>
          {row(1, '09:00', t('sample.breakfast'))}
          {row(2, '12:00', t('sample.tsukiji'))}
        </>,
      );
    case 'dayRecap':
      return day(
        <>
          {row(1, '10:00', t('sample.sensoji'), { done: true })}
          {row(2, '13:00', t('sample.skytree'), { done: true })}
          {row(3, '18:00', t('sample.ichiran'), { done: true })}
          <p className="rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
            {t('labs.recap', { n: 3, km: 6.4 })}
          </p>
        </>,
      );
    case 'nowScroll':
      return day(
        <>
          {row(1, '10:00', t('sample.sensoji'), { done: true })}
          {row(2, '13:00', t('sample.skytree'), { now: true })}
          {row(3, '18:00', t('sample.ichiran'))}
          <p className="text-center text-caption text-fg-muted">{t('labs.previewNow')}</p>
        </>,
      );
    case 'homeTime':
      return day(
        <>
          {row(1, '10:00', t('sample.watArun'), { home: '12:00' })}
          {row(2, '13:00', t('sample.chatuchak'), { home: '15:00' })}
        </>,
      );
    case 'rainMark':
      return day(
        <>
          {row(1, '10:00', t('sample.sensoji'), { rain: true })}
          {row(2, '12:00', t('sample.ichiran'))}
        </>,
      );
    case 'checkinNotice':
      return day(
        <>
          {note(`🛎️ ${t('labs.checkinAt', { time: '15:00', name: t('sample.shinjukuHotel') })}`)}
          {row(1, '17:00', t('sample.shinjukuWalk'))}
        </>,
      );
    case 'returnNotice':
      return day(
        <>
          {note(
            `🛫 ${t('labs.returnAt', { time: '18:30', name: t('sample.flight') })}`,
            'bg-primary-weak text-primary',
          )}
          {row(1, '10:00', t('sample.ginza'))}
        </>,
      );
    case 'dayWalk':
      return day(
        <>
          <p className="text-micro text-fg-muted">{t('labs.dayWalk', { km: 6.4 })}</p>
          {row(1, '10:00', t('sample.sensoji'))}
          {row(2, '13:00', t('sample.skytree'))}
        </>,
      );
    case 'flightProgress':
      return note(t('labs.inAir', { name: 'KE703', h: 1, m: 20 }));
    case 'morningBrief':
      return note(t('labs.briefFirst', { n: 5, time: '09:30' }));
    case 'jetLag':
      return note(t('labs.jetLagBehind', { h: 2 }));
    case 'emptyDayWish':
      return day(
        <>
          <p className="text-body-2 text-fg-muted">{t('plan.emptyDay')}</p>
          <p className="flex min-h-11 items-center justify-center rounded-btn bg-primary-weak text-caption font-semibold text-primary">
            {t('labs.pickWish', { n: 4 })}
          </p>
        </>,
      );
    case 'tipCalc':
      return note(
        `💵 ${t('labs.tipTitle')} · $42.50 × 18% → ${t('labs.tipResult', { tip: '7.65', total: '50.15' })}`,
      );
    case 'bigTicket':
      return (
        <div className="flex flex-col items-center gap-2 rounded-card border border-line p-4 text-center">
          <p className="tabular text-[34px] leading-none font-black">KE703</p>
          <p className="tabular text-body-1">ICN → NRT</p>
          <p className="tabular text-[28px] leading-none font-black tracking-[0.12em]">AB12CD</p>
        </div>
      );
  }
}
