import { allCities, todayIn, type ItineraryItem, type Trip } from '@trippocket/shared';
import { CalendarRange, Check, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useNavigate, useParams } from 'react-router';
import { planReflow, type ReflowMode } from '../../domain/schedule';
import { useTrip, useTripItems } from '../../data/hooks';
import { updateTripWithReflow } from '../../data/services/tripService';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { cn } from '../../shared/lib/cn';
import { COVER_COLORS, DEFAULT_EMOJIS } from '../../shared/lib/coverColors';
import { formatPeriod, formatTripLength } from '../../shared/lib/dateFormat';
import type { DateRange } from '../../shared/lib/dateRange';
import {
  BottomSheet,
  Button,
  DateRangePicker,
  SegmentedControl,
  TopBar,
  toast,
} from '../../shared/ui';
import { deleteTripWithUndo } from './tripActions';

/** S-19 여행 설정 */
export function TripSettingsPage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const items = useTripItems(tripId);
  if (!trip || !items) return null;
  return <TripSettingsForm key={trip.id} trip={trip} items={items} />;
}

const inputClass =
  'h-12 w-full rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

function TripSettingsForm({ trip, items }: { trip: Trip; items: ItineraryItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState(trip.title);
  const [emoji, setEmoji] = useState(trip.cover.emoji ?? DEFAULT_EMOJIS[0]);
  const [color, setColor] = useState(trip.cover.color ?? COVER_COLORS[0]);
  const [timezone, setTimezone] = useState(trip.timezone);
  const [range, setRange] = useState<DateRange>({ start: trip.startDate, end: trip.endDate });
  const [draft, setDraft] = useState<DateRange>(range);
  const [mode, setMode] = useState<ReflowMode>('keepDayNumber');
  const [saving, setSaving] = useState(false);
  const [periodOpen, setPeriodOpen] = useRouteSheet('trip-period');

  const start = range.start ?? trip.startDate;
  const end = range.end ?? trip.endDate;
  const startChanged = start !== trip.startDate;
  const plan = planReflow(items, trip.startDate, start, end, startChanged ? mode : 'keepDate');
  const today = todayIn();
  // 지난 여행도 고칠 수 있게 달력은 여행 시작 달과 오늘 중 이른 달부터
  const calendarFrom = trip.startDate < today ? trip.startDate : today;

  const timezones = [...new Set([trip.timezone, ...allCities().map((c) => c.timezone)])];
  const tzLabel = (tz: string) => {
    const names = allCities()
      .filter((c) => c.timezone === tz)
      .map((c) => c.ko);
    return names.length ? `${names.slice(0, 3).join('·')} (${tz})` : tz;
  };

  async function save() {
    if (!title.trim()) {
      toast(t('newTrip.needTitle'));
      return;
    }
    setSaving(true);
    try {
      await updateTripWithReflow(
        trip.id,
        { title, timezone, startDate: start, endDate: end, cover: { emoji, color } },
        plan.moves,
      );
      toast(t('form.saved'));
      void navigate(-1);
    } catch {
      setSaving(false);
      toast(t('form.failed'));
    }
  }

  async function remove() {
    await deleteTripWithUndo(trip);
    void navigate('/trips', { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <TopBar title={t('tripSettings.title')} backTo={`/trips/${trip.id}/plan`} />
      <div className="flex flex-1 flex-col gap-6 px-5 pt-2 pb-6">
        <Field label={t('newTrip.nameLabel')}>
          <input
            id="trip-title"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>

        <section className="flex flex-col gap-2">
          <h2 className="text-caption font-semibold text-fg-sub">{t('tripSettings.period')}</h2>
          <button
            type="button"
            onClick={() => {
              setDraft(range);
              setPeriodOpen(true);
            }}
            className="flex h-12 items-center gap-3 rounded-btn border border-line bg-bg-subtle px-3 text-left"
          >
            <CalendarRange aria-hidden="true" className="size-5 text-fg-sub" />
            <span className="tabular flex-1 text-body-1">
              {formatPeriod(start, end)} · {formatTripLength(start, end)}
            </span>
            <span className="text-caption font-semibold text-primary">
              {t('tripSettings.change')}
            </span>
          </button>

          {startChanged && items.some((i) => i.date !== null) && (
            <SegmentedControl
              label={t('tripSettings.reflowMode')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'keepDayNumber', label: t('tripSettings.keepDayNumber') },
                { value: 'keepDate', label: t('tripSettings.keepDate') },
              ]}
            />
          )}
          {(range.start !== trip.startDate || range.end !== trip.endDate) && (
            <p
              role="status"
              className="rounded-btn bg-primary-weak px-3 py-2 text-caption text-fg-sub"
            >
              {plan.moves.length === 0
                ? t('tripSettings.previewNone')
                : [
                    plan.shifted > 0 && t('tripSettings.previewShift', { n: plan.shifted }),
                    plan.toWishlist > 0 && t('tripSettings.previewWish', { n: plan.toWishlist }),
                  ]
                    .filter(Boolean)
                    .join(' ')}
            </p>
          )}
        </section>

        <Field label={t('tripSettings.timezone')}>
          <select
            id="trip-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputClass}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tzLabel(tz)}
              </option>
            ))}
          </select>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-caption font-semibold text-fg-sub">
            {t('newTrip.emojiLabel')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {[...new Set([emoji, ...DEFAULT_EMOJIS])].map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={e === emoji}
                onClick={() => setEmoji(e)}
                className={cn(
                  'grid size-12 place-items-center rounded-btn border text-[24px]',
                  e === emoji ? 'border-primary bg-primary-weak' : 'border-line bg-surface',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-caption font-semibold text-fg-sub">
            {t('newTrip.colorLabel')}
          </legend>
          <div className="flex flex-wrap gap-3">
            {COVER_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === color}
                aria-label={t('newTrip.colorOption', { n: i + 1 })}
                onClick={() => setColor(c)}
                className="grid size-10 place-items-center rounded-full text-white"
                style={{ background: c }}
              >
                {c === color && <Check aria-hidden="true" className="size-5" />}
              </button>
            ))}
          </div>
        </fieldset>

        <Button
          variant="secondary"
          className="mt-4 text-danger"
          leading={<Trash2 aria-hidden="true" className="size-4" />}
          onClick={() => void remove()}
        >
          {t('trips.delete')}
        </Button>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-bg px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button size="lg" fullWidth loading={saving} onClick={() => void save()}>
          {t('form.save')}
        </Button>
      </div>

      <BottomSheet
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        title={t('tripSettings.period')}
        footer={
          <Button
            size="lg"
            fullWidth
            disabled={!draft.start || !draft.end}
            onClick={() => {
              setRange(draft);
              setPeriodOpen(false);
            }}
          >
            {t('date.done')}
          </Button>
        }
      >
        <DateRangePicker
          value={draft}
          onChange={setDraft}
          today={today}
          from={calendarFrom}
          inSheet
        />
      </BottomSheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold text-fg-sub">{label}</span>
      {children}
    </label>
  );
}
