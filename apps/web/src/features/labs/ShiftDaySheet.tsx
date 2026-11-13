import type { ItineraryItem } from '@trippocket/shared';
import { useState } from 'react';
import { itemRepo } from '../../data/repositories/itemRepo';
import { shiftPatches } from '../../domain/labTools';
import { useTranslation } from '../../i18n';
import { BottomSheet, Chip, snackbar, toast } from '../../shared/ui';

const DELTAS = [-30, -15, 15, 30, 60] as const;

/**
 * 남은 일정 미루기·당기기 (실험실 shiftDay, 2026-11-13): 늦잠·줄 서기로 밀렸을 때 그날 일정 시각을 한 번에.
 * 오늘이면 지금 이후 시작하는 일정만, 예약에서 넘어온 일정(항공·숙소 등)은 그대로. [실행 취소] 있음
 */
export function ShiftDaySheet({
  open,
  onOpenChange,
  items,
  now,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly ItineraryItem[];
  /** 오늘이면 현지 "HH:mm" (그 뒤 일정만), 아니면 undefined (모두) */
  now: string | undefined;
}) {
  const { t } = useTranslation();
  const [delta, setDelta] = useState<number>(30);
  const { patches, skipped } = shiftPatches(items, delta, now);
  const apply = async () => {
    const before = items
      .filter((i) => patches.some((p) => p.id === i.id))
      .map((i) => ({ id: i.id, startTime: i.startTime, endTime: i.endTime }));
    for (const p of patches)
      await itemRepo.update(p.id, { startTime: p.startTime, endTime: p.endTime });
    onOpenChange(false);
    snackbar(
      t(delta > 0 ? 'tool.shiftedLater' : 'tool.shiftedEarlier', {
        n: patches.length,
        m: Math.abs(delta),
      }),
      {
        label: t('common.undo'),
        onAction: () =>
          void Promise.all(
            before.map((b) =>
              itemRepo.update(b.id, { startTime: b.startTime, endTime: b.endTime }),
            ),
          ),
      },
    );
    if (skipped) toast(t('tool.shiftSkipped', { n: skipped }));
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('tool.shiftTitle')}
      description={now ? t('tool.shiftDescToday', { time: now }) : t('tool.shiftDesc')}
    >
      <div className="flex flex-wrap gap-2">
        {DELTAS.map((d) => (
          <Chip key={d} selected={d === delta} onClick={() => setDelta(d)}>
            {t(d > 0 ? 'tool.later' : 'tool.earlier', { m: Math.abs(d) })}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        disabled={!patches.length}
        onClick={() => void apply()}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-btn bg-primary text-body-1 font-semibold text-on-primary disabled:opacity-40"
      >
        {patches.length ? t('tool.shiftApply', { n: patches.length }) : t('tool.shiftNone')}
      </button>
    </BottomSheet>
  );
}
