import {
  flagEmoji,
  popularCities,
  searchPlaces,
  todayIn,
  type Destination,
  type PlaceHit,
} from '@trippocket/shared';
import { Check, Globe, MapPin, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useNavigate, useSearchParams } from 'react-router';
import { tripRepo } from '../../data/repositories/tripRepo';
import { COVER_COLORS, DEFAULT_EMOJIS } from '../../shared/lib/coverColors';
import { EmojiPicker } from './EmojiPicker';
import { formatMonthDay, formatTripLength } from '../../shared/lib/dateFormat';
import type { DateRange } from '../../shared/lib/dateRange';
import { Button, Chip, TopBar, toast } from '../../shared/ui';
import { TripCalendar } from './TripCalendar';

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

  const [destinations, setDestinations] = useState<Destination[]>([]);
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

  // 첫 목적지의 시간대·국기가 여행 기본값 (목록에 없는 곳이면 기기 시간대)
  const first = destinations[0];
  const timezone = first?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayIn();
  const suggestedTitle = t('newTrip.titleDefault', {
    dest: destinations.map((d) => d.name).join('·'),
  });
  const effectiveTitle = title ?? suggestedTitle;
  const effectiveEmoji =
    emoji ?? (first?.countryCode ? flagEmoji(first.countryCode) : DEFAULT_EMOJIS[0]);

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
          <TripCalendar
            destinations={destinations}
            value={range}
            onChange={setRange}
            today={today}
          />
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
              <EmojiPicker
                countryCodes={destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))}
                value={effectiveEmoji}
                onChange={setEmoji}
              />
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

/** 검색 결과 → 저장할 목적지 */
function toDestination(hit: PlaceHit): Destination {
  return {
    name: hit.ko,
    kind: hit.kind,
    countryCode: hit.countryCode,
    coords: { lat: hit.lat, lng: hit.lng },
    timezone: hit.timezone,
  };
}

const sameDest = (a: Destination, b: Destination) =>
  a.name === b.name && a.countryCode === b.countryCode;

/**
 * ① 어디로: 도시·국가 검색 (한글·영어·별칭·초성). 고른 곳의 국가·좌표·시간대가 저장되어
 * 지도·장소 검색·추천의 기준이 된다. 목록에 없으면 직접 추가.
 */
function WhereStep({
  selected,
  onChange,
  footer,
}: {
  selected: Destination[];
  onChange: (next: Destination[]) => void;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const hits = searchPlaces(trimmed);
  const exact = hits.some((h) => h.ko === trimmed || h.en.toLowerCase() === trimmed.toLowerCase());
  const canAddCustom = trimmed.length > 0 && !exact && !selected.some((d) => d.name === trimmed);

  function toggle(dest: Destination) {
    onChange(
      selected.some((d) => sameDest(d, dest))
        ? selected.filter((d) => !sameDest(d, dest))
        : [...selected, dest],
    );
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
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-body-1 text-fg outline-none"
        />
      </label>

      {selected.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-caption font-semibold text-fg-sub">{t('newTrip.selected')}</span>
          <div className="flex flex-wrap gap-2">
            {selected.map((d) => (
              <Chip
                key={`${d.name}-${d.countryCode ?? ''}`}
                selected
                aria-label={t('newTrip.remove', { name: d.name })}
                onClick={() => toggle(d)}
                leading={
                  d.countryCode ? (
                    <span aria-hidden="true">{flagEmoji(d.countryCode)}</span>
                  ) : undefined
                }
              >
                {d.name}
                <X aria-hidden="true" className="size-3.5" />
              </Chip>
            ))}
          </div>
        </div>
      )}

      {trimmed ? (
        <ul aria-label={t('newTrip.results')} className="mt-4 flex flex-col divide-y divide-line">
          {hits.map((h) => {
            const dest = toDestination(h);
            const on = selected.some((d) => sameDest(d, dest));
            return (
              <li key={`${h.kind}-${h.ko}-${h.countryCode}`}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    toggle(dest);
                    setQuery('');
                  }}
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                >
                  <span aria-hidden="true" className="text-[22px] leading-none">
                    {flagEmoji(h.countryCode)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-1">{h.ko}</span>
                    <span className="truncate text-caption text-fg-muted">
                      {h.kind === 'city'
                        ? `${h.en} · ${h.countryKo}`
                        : `${h.en} · ${t('newTrip.wholeCountry')}`}
                    </span>
                  </span>
                  {h.kind === 'country' ? (
                    <Globe aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
                  ) : (
                    <MapPin aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
                  )}
                  {on && <Check aria-hidden="true" className="size-5 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
          {canAddCustom && (
            <li>
              <button
                type="button"
                onClick={() => {
                  toggle({ name: trimmed, kind: 'custom' });
                  setQuery('');
                }}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
              >
                <Plus aria-hidden="true" className="size-5 text-primary" />
                <span className="flex flex-col">
                  <span className="text-body-1">{t('newTrip.addCustom', { name: trimmed })}</span>
                  <span className="text-caption text-fg-muted">{t('newTrip.customHint')}</span>
                </span>
              </button>
            </li>
          )}
        </ul>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-caption font-semibold text-fg-sub">{t('newTrip.popular')}</span>
          <div className="flex flex-wrap gap-2">
            {popularCities().map((c) => {
              const dest: Destination = {
                name: c.ko,
                kind: 'city',
                countryCode: c.countryCode,
                coords: { lat: c.lat, lng: c.lng },
                timezone: c.timezone,
              };
              return (
                <Chip
                  key={c.ko}
                  selected={selected.some((d) => sameDest(d, dest))}
                  onClick={() => toggle(dest)}
                  leading={<span aria-hidden="true">{flagEmoji(c.countryCode)}</span>}
                >
                  {c.ko}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
    </StepBody>
  );
}
