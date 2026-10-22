import { findCity, searchCities, todayIn } from '@trippocket/shared';
import { Check, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useNavigate, useSearchParams } from 'react-router';
import { tripRepo } from '../../data/repositories/tripRepo';
import { cn } from '../../shared/lib/cn';
import { COVER_COLORS, DEFAULT_EMOJIS } from '../../shared/lib/coverColors';
import { formatMonthDay, formatTripLength } from '../../shared/lib/dateFormat';
import type { DateRange } from '../../shared/lib/dateRange';
import { Button, Chip, DateRangePicker, TopBar, toast } from '../../shared/ui';

type Step = 1 | 2 | 3;

/**
 * S-03 여행 만들기 — 한 화면 한 질문 (docs/05 §3).
 * 단계는 주소(?step=)로 관리해서 휴대폰 뒤로가기 = 이전 단계, 입력값은 그대로 유지된다.
 * 만든 뒤에는 단계 기록을 걷어내서, 여행 화면에서 뒤로가기 하면 만들기 전 화면으로 돌아간다.
 */
export function NewTripPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = (Number(params.get('step')) || 1) as Step;

  const [destinations, setDestinations] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [title, setTitle] = useState<string | null>(null); // null = 아직 안 고침 → 기본 제안 사용
  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<string>(COVER_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const createdId = useRef<string | null>(null);

  // 새로고침 등으로 입력값 없이 중간 단계에 들어오면 처음으로
  useEffect(() => {
    if (step > 1 && destinations.length === 0 && !createdId.current) {
      setParams({}, { replace: true });
    }
  }, [step, destinations.length, setParams]);

  // 단계 기록을 1단계까지 걷어낸 뒤, 그 자리를 여행 화면으로 바꾼다
  useEffect(() => {
    if (createdId.current && step === 1) {
      void navigate(`/trips/${createdId.current}/plan`, { replace: true });
    }
  }, [step, navigate]);

  const firstCity = destinations[0] ? findCity(destinations[0]) : undefined;
  const timezone = firstCity?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayIn();
  const suggestedTitle = t('newTrip.titleDefault', { dest: destinations.join('·') });
  const effectiveTitle = title ?? suggestedTitle;
  const effectiveEmoji = emoji ?? firstCity?.emoji ?? DEFAULT_EMOJIS[0];

  function goTo(next: Step) {
    setParams(next === 1 ? {} : { step: String(next) });
  }

  async function create() {
    if (!range.start || !range.end) return;
    if (!effectiveTitle.trim()) {
      toast(t('newTrip.needTitle'));
      return;
    }
    setSaving(true);
    try {
      const trip = await tripRepo.create({
        title: effectiveTitle,
        destinations,
        startDate: range.start,
        endDate: range.end,
        timezone,
        cover: { emoji: effectiveEmoji, color },
      });
      toast(t('newTrip.created'));
      createdId.current = trip.id;
      if (step > 1) void navigate(-(step - 1));
      else void navigate(`/trips/${trip.id}/plan`, { replace: true });
    } catch {
      setSaving(false);
      toast(t('newTrip.needTitle'));
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <TopBar
        title={t('newTrip.title')}
        subtitle={t('newTrip.progress', { step })}
        backTo="/trips"
      />
      <div aria-hidden="true" className="mx-5 h-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {step === 1 && (
        <WhereStep
          selected={destinations}
          onChange={setDestinations}
          footer={
            <Button
              size="lg"
              fullWidth
              disabled={destinations.length === 0}
              onClick={() => goTo(2)}
            >
              {t('common.next')}
            </Button>
          }
        />
      )}

      {step === 2 && (
        <StepBody
          title={t('newTrip.whenTitle')}
          footer={
            <div className="flex flex-col gap-2">
              <p className="tabular text-center text-body-2 text-fg-sub" aria-live="polite">
                {range.start && range.end
                  ? `${formatMonthDay(range.start)} – ${formatMonthDay(range.end)} · ${formatTripLength(range.start, range.end)}`
                  : t(range.start ? 'date.pickEnd' : 'date.pickStart')}
              </p>
              <Button
                size="lg"
                fullWidth
                disabled={!range.start || !range.end}
                onClick={() => goTo(3)}
              >
                {t('common.next')}
              </Button>
            </div>
          }
        >
          <DateRangePicker value={range} onChange={setRange} today={today} />
        </StepBody>
      )}

      {step === 3 && (
        <StepBody
          title={t('newTrip.nameTitle')}
          footer={
            <Button
              size="lg"
              fullWidth
              loading={saving}
              disabled={!range.start || !range.end || destinations.length === 0}
              onClick={() => void create()}
            >
              {t('newTrip.create')}
            </Button>
          }
        >
          <div className="flex flex-col gap-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-fg-sub">
                {t('newTrip.nameLabel')}
              </span>
              <input
                id="trip-title"
                value={effectiveTitle}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary"
              />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-caption font-semibold text-fg-sub">
                {t('newTrip.emojiLabel')}
              </legend>
              <div className="flex flex-wrap gap-2">
                {emojiOptions(destinations).map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={e === effectiveEmoji}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      'grid size-12 place-items-center rounded-btn border text-[24px]',
                      e === effectiveEmoji
                        ? 'border-primary bg-primary-weak'
                        : 'border-line bg-surface',
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
          </div>
        </StepBody>
      )}
    </div>
  );
}

function emojiOptions(destinations: string[]): string[] {
  const fromCities = destinations.map((d) => findCity(d)?.emoji).filter((e): e is string => !!e);
  return [...new Set([...fromCities, ...DEFAULT_EMOJIS])].slice(0, 10);
}

function StepBody({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      <div className="flex-1 px-5 pt-6 pb-4">
        <h2 className="mb-5 text-display">{title}</h2>
        {children}
      </div>
      <div className="sticky bottom-0 border-t border-line bg-bg px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </>
  );
}

function WhereStep({
  selected,
  onChange,
  footer,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const results = searchCities(query);
  const trimmed = query.trim();
  const canAddCustom = trimmed.length > 0 && !findCity(trimmed) && !selected.includes(trimmed);

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  return (
    <StepBody title={t('newTrip.whereTitle')} footer={footer}>
      <p className="-mt-3 mb-4 text-body-2 text-fg-muted">{t('newTrip.whereHint')}</p>
      <label className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3 text-fg-muted">
        <Search aria-hidden="true" className="size-[18px]" />
        <input
          id="city-search"
          type="search"
          aria-label={t('newTrip.searchLabel')}
          placeholder={t('newTrip.searchPlaceholder')}
          value={query}
          maxLength={40}
          onChange={(e) => setQuery(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-body-1 text-fg outline-none"
        />
      </label>

      {selected.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-caption font-semibold text-fg-sub">{t('newTrip.selected')}</span>
          <div className="flex flex-wrap gap-2">
            {selected.map((name) => (
              <Chip
                key={name}
                selected
                aria-label={t('newTrip.remove', { name })}
                onClick={() => toggle(name)}
              >
                {name}
                <X aria-hidden="true" className="size-3.5" />
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {canAddCustom && (
          <Chip
            className="border-dashed"
            onClick={() => {
              toggle(trimmed);
              setQuery('');
            }}
          >
            {t('newTrip.addCustom', { name: trimmed })}
          </Chip>
        )}
        {results.map((c) => (
          <Chip key={c.name} selected={selected.includes(c.name)} onClick={() => toggle(c.name)}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>
      {results.length === 0 && trimmed && (
        <p className="mt-3 text-caption text-fg-muted">{t('newTrip.noMatch')}</p>
      )}
    </StepBody>
  );
}
