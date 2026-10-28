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
    opts: {
      now?: boolean;
      done?: boolean;
      tight?: boolean;
      /** 날씨 주의 이모지 (시간 아래) */
      caution?: string;
      /** 시간 겹침 경고 줄 */
      overlap?: boolean;
    } = {},
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
        {opts.caution && <span className="block text-caption leading-tight">{opts.caution}</span>}
      </span>
      <span className="flex flex-1 flex-col">
        {title}
        {opts.overlap && <span className="text-caption text-warning">{t('labs.overlap')}</span>}
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
    // ── 2026-10-28 정식: 날씨 주의·시차 안내 ──
    case 'weatherMark':
      return day(
        <>
          {row(1, '10:00', t('sample.sensoji'), { caution: '☔🧥' })}
          {row(2, '12:00', t('sample.ichiran'), { caution: '☔🧥' })}
        </>,
      );
    case 'jetLag':
      return note(t('labs.jetLagBehind', { h: 2 }));
    // ── 실험실 2026-10-28 ──
    case 'airportArrive':
      return (
        <div className="flex flex-col gap-2 rounded-btn border border-dashed border-fg-muted/60 p-3">
          <p className="tabular text-body-1 font-bold">ICN 18:30 ✈ NRT 20:55</p>
          <p className="tabular text-caption font-semibold text-primary">
            {t('labs.airportArrive', { time: '15:30' })}{' '}
            <span className="font-normal text-fg-muted">({t('labs.airportBefore', { h: 3 })})</span>
          </p>
        </div>
      );
    case 'localHoliday':
      return day(
        <>
          {note(
            t('labs.localHoliday', { name: t('sample.holiday') }),
            'bg-danger/10 text-danger whitespace-pre-line',
          )}
          {row(1, '10:00', t('sample.sensoji'))}
        </>,
      );
    case 'overlapWarn':
      return day(
        <>
          {row(1, '11:00', t('sample.sensoji'))}
          {row(2, '11:30', t('sample.skytree'), { overlap: true })}
        </>,
      );
    case 'goldenHour':
      return day(
        <>
          {row(1, '15:00', t('sample.skytree'))}
          {sunLine('set', '17:20')}
          <p className="tabular text-center text-micro text-warning">
            {t('labs.goldenHour', { start: '16:20', end: '17:20' })}
          </p>
          {row(2, '18:30', t('sample.ichiran'))}
        </>,
      );
    case 'plugInfo':
      return (
        <div className="flex flex-col rounded-card bg-bg-subtle px-4 py-2.5 text-caption text-fg-sub">
          <span className="font-semibold text-fg">
            {t('labs.plug', { country: t('sample.japan'), types: 'A·B', volt: 100 })}
          </span>
          <span className="text-warning">{t('labs.plugAdapter')}</span>
          <span className="text-warning">{t('labs.plugLowVolt')}</span>
        </div>
      );
    case 'tripProgress':
      return (
        <div className="flex flex-col gap-1 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          {t('labs.tripProgress', { day: 3, days: 5, done: 7, total: 9 })}
          <span className="h-1.5 overflow-hidden rounded-full bg-line">
            <span className="block h-full w-3/5 rounded-full bg-primary" />
          </span>
        </div>
      );
    case 'memoChecklist':
      return (
        <div className="flex flex-col gap-1.5 rounded-card border border-line p-3 text-body-2">
          {(
            [
              [t('sample.memoPassport'), true],
              [t('sample.memoTicket'), false],
            ] as const
          ).map(([text, on]) => (
            <span key={text} className="flex items-center gap-2">
              <span
                className={cn(
                  'grid size-5 place-items-center rounded border text-micro',
                  on ? 'border-primary bg-primary text-white' : 'border-line',
                )}
              >
                {on ? '✓' : ''}
              </span>
              <span className={cn(on && 'text-fg-muted line-through')}>{text}</span>
            </span>
          ))}
        </div>
      );
    case 'lateNight':
      return day(
        <>
          {row(1, '20:00', t('sample.ichiran'))}
          {row(2, '22:30', t('sample.shinjukuWalk'))}
          {note(
            t('labs.lateNight', { time: '22:30' }),
            'bg-primary-weak text-primary whitespace-pre-line',
          )}
        </>,
      );
    case 'fxLine':
      return note(t('labs.fxLine', { unit: 100, code: 'JPY', won: '912', date: '10.28' }));
    case 'luggageGap':
      return day(
        <>
          {note(
            t('labs.luggageGap', { checkIn: '15:00', h: 4, name: t('sample.shinjukuHotel') }),
            'bg-bg-subtle text-fg-sub whitespace-pre-line',
          )}
          {row(1, '09:30', t('sample.arrive'))}
        </>,
      );
  }
}
