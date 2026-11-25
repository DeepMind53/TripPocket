import type { Booking, ItineraryItem, LocalDate } from '@trippocket/shared';
import { useState } from 'react';
import { itemRepo } from '../../data/repositories/itemRepo';
import { useSettings } from '../../data/settingsStore';
import { lodgingStopTimes } from '../../domain/defaultTimes';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, Chip, Switch, TimeInput, toast } from '../../shared/ui';

/**
 * [숙소 일정 추가] (2026-11-25 사용자 요청): 그날 숙소에서 나가는 시각(맨 앞 일정)과 숙소로 돌아오는 시각(맨 끝 일정)을
 * 일정 두 줄로 넣는다 — 번호·지도 핀·이동 시간·길찾기가 다른 일정과 같게. 숙소를 옮기는 날은 출발·도착 숙소를 따로 고른다
 */
export function LodgingStopsSheet({
  open,
  onOpenChange,
  tripId,
  date,
  lodgings,
  dayItems,
  planId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  date: LocalDate;
  /** 그날 숙소 — 아침에 나오는 곳 먼저, 오늘 밤 숙소 다음 (domain/lodging lodgingsOfDay) */
  lodgings: readonly Booking[];
  dayItems: readonly ItineraryItem[];
  planId?: string | undefined;
}) {
  const { t } = useTranslation();
  const step = useSettings((s) => s.timeStepMin) * 60;
  const defaults = lodgingStopTimes(dayItems);
  const [departOn, setDepartOn] = useState(true);
  const [arriveOn, setArriveOn] = useState(true);
  const [departAt, setDepartAt] = useState(defaults.depart);
  const [arriveAt, setArriveAt] = useState(defaults.arrive);
  const [from, setFrom] = useState(lodgings[0]?.id ?? '');
  const [to, setTo] = useState(lodgings.at(-1)?.id ?? '');
  const [saving, setSaving] = useState(false);
  const byId = (id: string) => lodgings.find((b) => b.id === id);

  const place = (b: Booking) => ({
    name: b.title,
    ...(b.details?.address ? { address: b.details.address } : {}),
    ...(b.start.coords ? { coords: b.start.coords } : {}),
  });

  async function save() {
    const fromB = byId(from);
    const toB = byId(to);
    setSaving(true);
    try {
      if (departOn && fromB)
        await itemRepo.create(
          {
            tripId,
            date,
            kind: 'lodging',
            title: t('lodgingStop.departTitle', { name: fromB.title }),
            startTime: departAt,
            place: place(fromB),
            ...(planId ? { planId } : {}),
          },
          0,
        );
      if (arriveOn && toB)
        await itemRepo.create({
          tripId,
          date,
          kind: 'lodging',
          title: t('lodgingStop.arriveTitle', { name: toB.title }),
          startTime: arriveAt,
          place: place(toB),
          ...(planId ? { planId } : {}),
        });
      toast(t('lodgingStop.added'));
      onOpenChange(false);
    } catch {
      toast(t('form.failed'));
    } finally {
      setSaving(false);
    }
  }

  const picker = (value: string, onPick: (id: string) => void, label: string) =>
    lodgings.length > 1 && (
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {lodgings.map((b) => (
          <Chip key={b.id} selected={value === b.id} onClick={() => onPick(b.id)}>
            {b.title}
          </Chip>
        ))}
      </div>
    );

  const row = (
    on: boolean,
    setOn: (v: boolean) => void,
    label: string,
    time: string,
    setTime: (v: string) => void,
    id: string,
    pick: React.ReactNode,
  ) => (
    <section className="flex flex-col gap-2 rounded-card border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-1 font-medium">{label}</span>
        <Switch label={label} checked={on} onCheckedChange={setOn} />
      </div>
      {on && (
        <>
          {pick}
          <TimeInput id={id} step={step} value={time} onChange={setTime} label={label} />
        </>
      )}
    </section>
  );

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('lodgingStop.title')}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-caption whitespace-pre-line text-fg-muted">{t('lodgingStop.desc')}</p>
        {row(
          departOn,
          setDepartOn,
          t('lodgingStop.depart'),
          departAt,
          setDepartAt,
          'lodging-depart',
          picker(from, setFrom, t('lodgingStop.depart')),
        )}
        {row(
          arriveOn,
          setArriveOn,
          t('lodgingStop.arrive'),
          arriveAt,
          setArriveAt,
          'lodging-arrive',
          picker(to, setTo, t('lodgingStop.arrive')),
        )}
        <Button
          fullWidth
          loading={saving}
          disabled={(!departOn || !departAt) && (!arriveOn || !arriveAt)}
          onClick={() => void save()}
        >
          {t('lodgingStop.save')}
        </Button>
      </div>
    </BottomSheet>
  );
}
