import { Footprints, Moon, MoonStar, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import type { WeatherCaution } from '../../domain/weather';
import { ArrivalRoute } from './ArrivalRoute';
import { CautionIcons } from './CautionIcons';
import { NearbyFind } from './NearbyFind';
import { TransitGuide } from './TransitGuide';
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
      /** 날씨 주의 그림 (시간 아래) */
      caution?: readonly WeatherCaution[];
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
        <CautionIcons cautions={opts.caution} />
      </span>
      <span className="flex flex-1 flex-col">{title}</span>
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
          {row(1, '10:00', t('sample.sensoji'), { caution: ['rain', 'cold'] })}
          {row(2, '12:00', t('sample.ichiran'), { caution: ['rain', 'cold'] })}
        </>,
      );
    case 'jetLag':
      return note(t('labs.jetLagBehind', { h: 2 }));
    // ── 2026-10-28 정식: 현지 공휴일·늦은 귀가 ──
    case 'localHoliday':
      return day(
        <>
          <p className="flex items-center gap-1.5 text-caption text-danger">
            <span className="size-1.5 rounded-full bg-danger" />
            {t('plan.localHoliday', { name: t('sample.holiday') })}
          </p>
          {row(1, '10:00', t('sample.sensoji'))}
        </>,
      );
    case 'lateNight':
      return day(
        <>
          {row(1, '20:00', t('sample.ichiran'))}
          {row(2, '22:30', t('sample.shinjukuWalk'))}
          <p className="flex items-start gap-2 rounded-btn bg-primary-weak px-3 py-2 text-caption whitespace-pre-line text-primary">
            <MoonStar aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {t('plan.lateNight', { time: '22:30' })}
          </p>
        </>,
      );
    // ── 실험실 2026-11-03 ── (실제 부품에 샘플 값)
    case 'transitGuide':
      return <TransitGuide country="JP" label={t('sample.japan')} />;
    case 'nearbyFind':
      return <NearbyFind domestic={false} />;
    case 'arrivalRoute':
      return (
        <ArrivalRoute
          route={{ from: t('sample.airport'), to: t('sample.shinjukuHotel'), date: '2026-11-12' }}
        />
      );
    case 'missingStay':
      return note(
        t('missingStay.text', { dates: '11.13, 11.14' }),
        'bg-warning/10 text-fg-sub whitespace-pre-line',
      );
    case 'offlineReady':
      return (
        <div className="flex flex-col gap-1">
          {note(
            t('offlineReady.vouchers', { n: 2 }),
            'bg-bg-subtle text-fg-sub whitespace-pre-line',
          )}
          {note(t('offlineReady.maps'), 'bg-bg-subtle text-fg-sub whitespace-pre-line')}
        </div>
      );
    case 'airQuality':
      return day(
        <>
          {note(t('air.pm25Bad', { v: 48 }), 'bg-warning/10 text-fg-sub whitespace-pre-line')}
          {note(t('air.uvVeryHigh', { v: 9 }), 'bg-warning/10 text-fg-sub whitespace-pre-line')}
          {row(1, '10:00', t('sample.sensoji'))}
        </>,
      );
    case 'cityIntro':
      return (
        <div className="flex flex-col gap-1 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          <span className="font-semibold text-fg">
            {t('cityIntro.title', { name: t('sample.tokyo') })}
          </span>
          {t('sample.tokyoIntro')}
          <span className="text-micro text-fg-muted">{t('cityIntro.source')}</span>
        </div>
      );
    case 'placeTips':
      return day(
        <>
          {note(t('placeTips.dress'), 'bg-bg-subtle text-fg-sub whitespace-pre-line')}
          {row(1, '10:00', t('sample.sensoji'))}
        </>,
      );
  }
}
