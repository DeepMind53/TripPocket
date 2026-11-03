import { addDays, getTripStatus, todayIn, type Trip } from '@trippocket/shared';
import { useState } from 'react';
import { dayKey, setMood, useDayPlanStore } from '../../data/dayPlanStore';
import { useTripItems, useTrips } from '../../data/hooks';
import { estimateSteps, MOODS } from '../../domain/dayPlan';
import { timeIn } from '../../shared/hooks/useMinuteClock';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { BottomSheet, Button } from '../../shared/ui';

/** 이번 실행에서 "나중에"를 누른 날 (다시 열면 또 묻는다 — 하루 한 번 고르기 전까지) */
const later = new Set<string>();

/**
 * Plan B (실험실, 사용자 요청 2026-11-03): 여행 중이면 현지 시각 아침 5시 이후 처음 열 때 오늘 컨디션을 묻는다.
 * 이모지 5단계 + 어제 걸음 수(일정으로 추정) → 피로도 → 조건이 맞는 플랜을 먼저 보여 준다
 */
export default function ConditionCheck() {
  const trips = useTrips();
  const trip = trips?.find(
    (t) => getTripStatus(t.startDate, t.endDate, todayIn(t.timezone)) === 'ongoing',
  );
  return trip ? <Ask trip={trip} /> : null;
}

function Ask({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const today = todayIn(trip.timezone);
  const key = dayKey(trip.id, today);
  const mood = useDayPlanStore((s) => s.moods[key]);
  const items = useTripItems(trip.id);
  const [dismissed, setDismissed] = useState(() => later.has(key));
  // 오늘 컨디션을 아직 안 골랐고, 현지 아침 5시가 지났으면
  const open =
    mood == null && !dismissed && (timeIn(trip.timezone, new Date()) ?? '00:00') >= '05:00';
  const close = () => {
    later.add(key);
    setDismissed(true);
  };
  const steps = estimateSteps((items ?? []).filter((i) => i.date === addDays(today, -1)));
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title={t('planB.check.title')}
      autoFocusInput={false}
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-caption whitespace-pre-line text-fg-sub">{t('planB.check.desc')}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {MOODS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(trip.id, today, i + 1)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-btn border border-line',
              )}
            >
              <span aria-hidden="true" className="text-title-2">
                {m}
              </span>
              <span className="text-micro text-fg-sub">
                {t(`planB.moods.${i + 1}` as 'planB.moods.1')}
              </span>
            </button>
          ))}
        </div>
        {steps > 0 && (
          <p className="text-caption text-fg-muted">
            {t('planB.check.steps', { steps: steps.toLocaleString() })}
          </p>
        )}
        <Button variant="ghost" fullWidth onClick={close}>
          {t('planB.check.later')}
        </Button>
      </div>
    </BottomSheet>
  );
}
