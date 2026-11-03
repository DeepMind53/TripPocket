import {
  addDays,
  getTripDays,
  PLAN_CONDITION_TYPES,
  PLAN_WEATHER,
  uuidv7,
  type DayPlan,
  type LocalDate,
  type PlanCondition,
  type Trip,
} from '@trippocket/shared';
import { ArrowRight, Check, Copy, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { setMood, setPick } from '../../data/dayPlanStore';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { MOODS } from '../../domain/dayPlan';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { BottomSheet, Button, confirmDelete, IconButton, toast } from '../../shared/ui';
import type { DayPlanInfo } from './usePlanView';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const LETTERS = 'BCDEFGH';

/** 새 조건의 처음 값 */
const fresh = (type: PlanCondition['type']): PlanCondition => {
  switch (type) {
    case 'weather':
      return { type, weather: ['rain'] };
    case 'tempMax':
      return { type, op: 'gte', value: 30 };
    case 'tempMin':
      return { type, op: 'lte', value: 5 };
    case 'fatigue':
      return { type, value: 4 };
    case 'weekday':
      return { type, days: [0, 6] };
    default:
      return { type };
  }
};

/**
 * Plan B 시트 (실험실, 사용자 요청 2026-11-03): 날짜 머리글을 누르면 열린다.
 * 오늘 컨디션(이모지 5단계) · 보일 플랜 고르기(자동/기본/플랜) · 플랜 만들기·조건 고치기·지우기
 */
export function DayPlanSheet({
  open,
  onOpenChange,
  trip,
  date,
  title,
  info,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  date: LocalDate | null;
  title: string;
  info: DayPlanInfo | undefined;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  // 다른 날로 복사·옮기기 (사용자 요청 2026-11-03)
  const [moving, setMoving] = useState<{ id: string; mode: 'copy' | 'move' } | null>(null);
  if (!date || !info) return null;
  const tripDays = getTripDays(trip.startDate, trip.endDate);
  const tomorrow = addDays(date, 1);
  const all = trip.dayPlans ?? [];
  const save = (next: DayPlan[]) => void tripRepo.update(trip.id, { dayPlans: next });
  const update = (p: DayPlan) => save(all.map((x) => (x.id === p.id ? p : x)));
  const add = () => {
    const p: DayPlan = {
      id: uuidv7(),
      date,
      name: `Plan ${LETTERS[info.plans.length] ?? info.plans.length + 2}`,
      match: 'any',
      conditions: [fresh('weather')],
    };
    save([...all, p]);
    setEditing(p.id);
  };
  const remove = async (p: DayPlan) => {
    if (!(await confirmDelete(t('planB.confirmDelete', { name: p.name })))) return;
    // 그 플랜 일정도 함께 지운다 (삭제 기록에서 되살릴 수 있음)
    for (const i of await itemRepo.listByTrip(trip.id))
      if (i.planId === p.id) await itemRepo.softDelete(i.id);
    save(all.filter((x) => x.id !== p.id));
    setPick(trip.id, date, null);
  };
  /** 플랜과 그 일정을 다른 날로: copy = 새 플랜으로 복제, move = 날짜만 바꾸기 */
  const relocate = async (p: DayPlan, to: LocalDate, mode: 'copy' | 'move') => {
    const planItems = (await itemRepo.listByTrip(trip.id)).filter((i) => i.planId === p.id);
    if (mode === 'copy') {
      const id = uuidv7();
      save([...all, { ...p, id, date: to }]);
      for (const i of planItems) {
        const {
          id: _id,
          createdAt: _c,
          updatedAt: _u,
          deletedAt: _d,
          rev: _r,
          order: _o,
          ...rest
        } = i;
        await itemRepo.create({ ...rest, date: to, planId: id, done: undefined, visit: undefined });
      }
    } else {
      save(all.map((x) => (x.id === p.id ? { ...x, date: to } : x)));
      for (const i of planItems) await itemRepo.move(i.id, to, Number.MAX_SAFE_INTEGER);
      setPick(trip.id, date, null);
    }
    setMoving(null);
    toast(
      t(mode === 'copy' ? 'planB.copied' : 'planB.moved', {
        name: p.name,
        date: formatMonthDay(to),
      }),
    );
  };
  const current = info.plan?.id ?? 'base';
  const pickRow = (id: string | null, label: string, sub?: string) => {
    const active = id === null ? info.by !== 'pick' : info.by === 'pick' && current === id;
    return (
      <button
        key={id ?? 'auto'}
        type="button"
        aria-pressed={active}
        onClick={() => setPick(trip.id, date, id)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-btn border px-3 py-2 text-left',
          active ? 'border-primary bg-primary-weak' : 'border-line',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-2 font-semibold">{label}</span>
          {sub && <span className="text-caption text-fg-muted">{sub}</span>}
        </span>
        {active && <Check aria-hidden="true" className="size-4 text-primary" />}
      </button>
    );
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('planB.sheetTitle', { day: title })}
    >
      <div className="flex flex-col gap-4 pb-2">
        {/* 오늘 컨디션 → 피로도 */}
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-bold text-fg-muted">{t('planB.mood')}</h3>
          <div className="grid grid-cols-5 gap-1.5">
            {MOODS.map((m, i) => (
              <button
                key={m}
                type="button"
                aria-pressed={info.mood === i + 1}
                aria-label={t(`planB.moods.${i + 1}` as 'planB.moods.1')}
                onClick={() => setMood(trip.id, date, i + 1)}
                className={cn(
                  'grid h-12 place-items-center rounded-btn border text-title-2',
                  info.mood === i + 1 ? 'border-primary bg-primary-weak' : 'border-line',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-caption whitespace-pre-line text-fg-sub">
            {info.fatigue == null
              ? t('planB.fatigueNone')
              : t(info.km == null ? 'planB.fatigueMood' : 'planB.fatigue', {
                  level: info.fatigue,
                  km: info.km ?? 0,
                })}
          </p>
        </section>

        {/* 보일 플랜 */}
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-bold text-fg-muted">{t('planB.show')}</h3>
          {pickRow(
            null,
            t('planB.auto'),
            info.by === 'auto' && info.plan
              ? t('planB.autoNow', { name: info.plan.name })
              : t('planB.autoBase'),
          )}
          {pickRow('base', t('planB.base'))}
          {info.plans.map((p) => pickRow(p.id, p.name, summary(p, t)))}
        </section>

        {/* 플랜 만들기·고치기 */}
        {canEdit && (
          <section className="flex flex-col gap-2">
            <h3 className="text-caption font-bold text-fg-muted">{t('planB.manage')}</h3>
            {info.plans.map((p) =>
              editing === p.id ? (
                <PlanEditor
                  key={p.id}
                  plan={p}
                  onChange={update}
                  onClose={() => setEditing(null)}
                />
              ) : (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(p.id)}
                    className="flex min-h-11 flex-1 flex-col justify-center rounded-btn bg-bg-subtle px-3 text-left"
                  >
                    <span className="text-body-2 font-semibold">{p.name}</span>
                    <span className="text-caption text-fg-muted">{summary(p, t)}</span>
                  </button>
                  <IconButton
                    label={t('planB.copy', { name: p.name })}
                    icon={<Copy />}
                    onClick={() =>
                      setMoving(
                        moving?.id === p.id && moving.mode === 'copy'
                          ? null
                          : { id: p.id, mode: 'copy' },
                      )
                    }
                  />
                  <IconButton
                    label={t('planB.move', { name: p.name })}
                    icon={<ArrowRight />}
                    onClick={() =>
                      setMoving(
                        moving?.id === p.id && moving.mode === 'move'
                          ? null
                          : { id: p.id, mode: 'move' },
                      )
                    }
                  />
                  <IconButton
                    label={t('planB.delete', { name: p.name })}
                    icon={<Trash2 />}
                    onClick={() => void remove(p)}
                  />
                </div>
              ),
            )}
            {moving && info.plans.some((p) => p.id === moving.id) && (
              <div className="flex flex-col gap-1.5 rounded-btn bg-bg-subtle p-2">
                <span className="text-caption font-semibold">
                  {t(moving.mode === 'copy' ? 'planB.copyTo' : 'planB.moveTo')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tripDays
                    .filter((d) => d !== date)
                    .map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          void relocate(
                            info.plans.find((p) => p.id === moving.id)!,
                            d,
                            moving.mode,
                          )
                        }
                        className="min-h-9 rounded-full border border-line bg-bg px-3 text-caption font-semibold"
                      >
                        {t('planB.dayChip', {
                          n: tripDays.indexOf(d) + 1,
                          date: formatMonthDay(d),
                        })}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {/* 오늘 안 쓴 플랜을 내일로 (지금 보이는 플랜이 있고 내일이 여행 안이면) */}
            {info.plan && tripDays.includes(tomorrow) && (
              <Button
                variant="secondary"
                fullWidth
                leading={<ArrowRight aria-hidden="true" className="size-4" />}
                onClick={() => void relocate(info.plan!, tomorrow, 'move')}
              >
                {t('planB.toTomorrow', { name: info.plan.name })}
              </Button>
            )}
            {info.plans.length < 5 && (
              <Button
                variant="secondary"
                fullWidth
                leading={<Plus aria-hidden="true" className="size-4" />}
                onClick={add}
              >
                {t('planB.add')}
              </Button>
            )}
            <p className="text-caption whitespace-pre-line text-fg-muted">{t('planB.addHint')}</p>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

/** "비·눈 또는 피로도 4 이상" */
function summary(p: DayPlan, t: T): string {
  if (!p.conditions.length) return t('planB.noCondition');
  return p.conditions
    .map((c) => condText(c, t))
    .join(t(p.match === 'all' ? 'planB.and' : 'planB.or'));
}

function condText(c: PlanCondition, t: T): string {
  switch (c.type) {
    case 'weather':
      return (c.weather ?? [])
        .map((w) => t(`planB.weather.${w}` as 'planB.weather.rain'))
        .join('·');
    case 'tempMax':
    case 'tempMin':
      return t(`planB.cond.${c.type}_${c.op ?? 'gte'}` as 'planB.cond.tempMax_gte', {
        v: c.value ?? 0,
      });
    case 'fatigue':
      return t('planB.cond.fatigue', { v: c.value ?? 4 });
    case 'weekday':
      return (c.days ?? []).map((d) => WEEKDAYS[d]).join('·') + t('planB.cond.weekdaySuffix');
    default:
      return t(`planB.cond.${c.type}` as 'planB.cond.air');
  }
}

function PlanEditor({
  plan,
  onChange,
  onClose,
}: {
  plan: DayPlan;
  onChange: (p: DayPlan) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(plan.name);
  const set = (i: number, c: PlanCondition) =>
    onChange({ ...plan, conditions: plan.conditions.map((x, j) => (j === i ? c : x)) });
  const chip = (on: boolean, label: string, onClick: () => void, key?: string) => (
    <button
      key={key ?? label}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full border px-3 text-caption font-semibold',
        on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-bg',
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary p-3">
      <label className="flex flex-col gap-1 text-caption text-fg-muted">
        {t('planB.name')}
        <input
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && onChange({ ...plan, name: name.trim() })}
          className="h-11 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 text-fg outline-none focus:border-primary"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {chip(plan.match === 'any', t('planB.matchAny'), () => onChange({ ...plan, match: 'any' }))}
        {chip(plan.match === 'all', t('planB.matchAll'), () => onChange({ ...plan, match: 'all' }))}
      </div>
      {plan.conditions.map((c, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-btn bg-bg-subtle p-2">
          <div className="flex items-center gap-1">
            <select
              aria-label={t('planB.condType')}
              value={c.type}
              onChange={(e) => set(i, fresh(e.target.value as PlanCondition['type']))}
              className="h-10 flex-1 rounded-btn border border-line bg-bg px-2 text-body-2"
            >
              {PLAN_CONDITION_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`planB.type.${ty}` as 'planB.type.weather')}
                </option>
              ))}
            </select>
            <IconButton
              label={t('planB.removeCond')}
              icon={<X />}
              onClick={() =>
                onChange({ ...plan, conditions: plan.conditions.filter((_, j) => j !== i) })
              }
            />
          </div>
          {c.type === 'weather' && (
            <div className="flex flex-wrap gap-1.5">
              {PLAN_WEATHER.map((w) =>
                chip(
                  !!c.weather?.includes(w),
                  t(`planB.weather.${w}` as 'planB.weather.rain'),
                  () =>
                    set(i, {
                      ...c,
                      weather: c.weather?.includes(w)
                        ? c.weather.filter((x) => x !== w)
                        : [...(c.weather ?? []), w],
                    }),
                  w,
                ),
              )}
            </div>
          )}
          {(c.type === 'tempMax' || c.type === 'tempMin') && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                aria-label={t('planB.temp')}
                value={c.value ?? 0}
                min={-50}
                max={60}
                onChange={(e) =>
                  set(i, { ...c, value: Math.max(-50, Math.min(60, Number(e.target.value) || 0)) })
                }
                className="h-10 w-20 rounded-btn border border-line bg-bg px-2 text-body-2"
              />
              <span className="text-caption">°C</span>
              {chip(c.op !== 'lte', t('planB.gte'), () => set(i, { ...c, op: 'gte' }))}
              {chip(c.op === 'lte', t('planB.lte'), () => set(i, { ...c, op: 'lte' }))}
            </div>
          )}
          {c.type === 'fatigue' && (
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m, k) =>
                chip(c.value === k + 1, `${m} ${k + 1}`, () => set(i, { ...c, value: k + 1 }), m),
              )}
              <span className="self-center text-caption text-fg-muted">{t('planB.atLeast')}</span>
            </div>
          )}
          {c.type === 'weekday' && (
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((d, k) =>
                chip(
                  !!c.days?.includes(k),
                  d,
                  () =>
                    set(i, {
                      ...c,
                      days: c.days?.includes(k)
                        ? c.days.filter((x) => x !== k)
                        : [...(c.days ?? []), k],
                    }),
                  d,
                ),
              )}
            </div>
          )}
          {(c.type === 'air' || c.type === 'holiday') && (
            <span className="text-caption whitespace-pre-line text-fg-muted">
              {t(`planB.hint.${c.type}` as 'planB.hint.air')}
            </span>
          )}
        </div>
      ))}
      {plan.conditions.length < 8 && (
        <Button
          size="sm"
          variant="ghost"
          leading={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => onChange({ ...plan, conditions: [...plan.conditions, fresh('weather')] })}
        >
          {t('planB.addCond')}
        </Button>
      )}
      <Button size="sm" onClick={onClose}>
        {t('planB.done')}
      </Button>
    </div>
  );
}
