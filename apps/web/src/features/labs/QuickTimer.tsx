import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLab } from '../../data/labsStore';
import { useTranslation } from '../../i18n';
import { BottomSheet, Chip } from '../../shared/ui';
import { setTimer, useTimer } from './timerStore';

const PRESETS = [10, 30, 60, 90, 120] as const;

const left = (end: number, now: number) => {
  const s = Math.max(0, Math.ceil((end - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
};

/**
 * 타이머 (실험실 quickTimer, 2026-11-13, 빠른 메뉴): 주차 시간·짐 보관·온천·세탁처럼 "몇 분 뒤"를 잊지 않게.
 * 끝나면 알림·진동 (앱이 열려 있을 때, TimerWatch)
 */
export function QuickTimer() {
  const { t } = useTranslation();
  const on = useLab('quickTimer');
  const { end } = useTimer();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!end) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [end]);
  if (!on) return null;
  const running = end !== null && end > now;
  const start = (m: number) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default')
      void Notification.requestPermission();
    setTimer(m);
    // 맞춘 순간 = 끝나는 때 − 맞춘 시간 (화면을 바로 새로)
    setNow((useTimer.getState().end ?? 0) - m * 60_000);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 items-center gap-2 rounded-card bg-bg-subtle px-3 text-left"
      >
        <Timer aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="flex-1 text-body-2 font-semibold">{t('tool.timerTitle')}</span>
        {running && <span className="tabular text-body-2 text-primary">{left(end, now)}</span>}
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t('tool.timerTitle')}
        description={t('tool.timerDesc')}
      >
        <div className="flex flex-col items-center gap-4 pb-2">
          <p aria-live="off" className="tabular text-[3rem] leading-none font-semibold">
            {running ? left(end, now) : '0:00'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((m) => (
              <Chip key={m} onClick={() => start(m)}>
                {m >= 60 && m % 60 === 0
                  ? t('tool.timerH', { h: m / 60 })
                  : m > 60
                    ? t('tool.timerHM', { h: Math.floor(m / 60), m: m % 60 })
                    : t('tool.timerM', { m })}
              </Chip>
            ))}
          </div>
          {running && (
            <button
              type="button"
              onClick={() => setTimer(null)}
              className="h-11 rounded-btn px-4 text-body-2 font-medium text-fg-sub active:bg-bg-subtle"
            >
              {t('tool.timerStop')}
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
