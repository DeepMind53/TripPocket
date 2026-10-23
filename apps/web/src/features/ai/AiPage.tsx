import {
  todayIn,
  type AiCategory,
  type CategoryResult,
  type PlaceSummary,
  type Recommendation,
} from '@trippocket/shared';
import { ChevronDown, Heart, MapPin, Plus, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../../data/api/client';
import { useAuth } from '../../data/authStore';
import { useTrip, useTripBookings } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import { lodgingForNight } from '../../domain/lodging';
import { isDomesticTrip } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  SegmentedControl,
  TopBar,
  toast,
} from '../../shared/ui';

type Rec = Recommendation & { place?: PlaceSummary };
interface Result {
  anchor: string;
  createdAt: string;
  /** engine: 정리한 AI. basic = 무료 AI가 모두 한도라 AI 없이 언급 수로 */
  categories: Partial<Record<AiCategory, CategoryResult & { places: Rec[]; engine?: string }>>;
}
const LAST_KEY = 'aiLast';
const CATS: AiCategory[] = ['food', 'cafe', 'play'];

/**
 * S-52 AI 추천 (docs/14 §7): 기준 위치(가까운 역·숙소·직접 입력) + 카테고리 → 블로그 최근 언급 많은 곳.
 * 근거(원문 링크·언급 수·기간)를 항상 보여 주고, 마지막 결과는 기기에 남겨 오프라인에서도 본다
 */
export function AiPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tripId = params.get('trip') ?? '';
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId) ?? [];
  const loggedIn = useAuth((s) => s.status === 'user');
  const lodging = trip
    ? (lodgingForNight(bookings, todayIn(trip.timezone))?.booking ??
      bookings.find((b) => b.kind === 'lodging'))
    : undefined;
  const [mode, setMode] = useState<'coords' | 'lodging' | 'text'>('text');
  const [text, setText] = useState('');
  const [cats, setCats] = useState<AiCategory[]>(['food', 'cafe']);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const domestic = trip ? isDomesticTrip(trip) : true;

  useEffect(() => {
    void settingsRepo
      .get<Result | null>(LAST_KEY, null)
      .then((r) => r && setResult((cur) => cur ?? r));
  }, []);

  async function anchor() {
    if (mode === 'lodging' && lodging) return { type: 'lodging', name: lodging.title };
    if (mode === 'coords') {
      const pos = await new Promise<GeolocationPosition>((ok, fail) =>
        navigator.geolocation.getCurrentPosition(ok, fail, { timeout: 10_000 }),
      );
      // 기기에서 약 100m 단위로 줄여 보낸다 — 서버는 역 이름으로 바꾼 뒤 버린다
      const r = (n: number) => Math.round(n * 1000) / 1000;
      return { type: 'coords', lat: r(pos.coords.latitude), lng: r(pos.coords.longitude) };
    }
    return { type: 'text', name: text.trim() };
  }

  async function run() {
    setBusy(true);
    try {
      const res = await api<Result>('/api/v1/ai/recommend', {
        method: 'POST',
        body: JSON.stringify({ anchor: await anchor(), categories: cats, domestic }),
      });
      if (res.ok) {
        setResult(res.data);
        await settingsRepo.set(LAST_KEY, res.data);
      } else
        toast(
          t(
            res.status === 429
              ? 'ai.limit'
              : res.status === 422
                ? 'ai.noAnchor'
                : res.reason === 'offline' || res.status === 503
                  ? 'ai.unavailable'
                  : 'ai.failed',
          ),
        );
    } catch {
      toast(t('ai.noLocation'));
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn)
    return (
      <div className="mx-auto min-h-dvh max-w-[560px]">
        <TopBar title={t('ai.title')} backTo="/" />
        <EmptyState
          emoji="✨"
          title={t('ai.title')}
          description={t('ai.needLogin')}
          action={
            <Button
              onClick={() =>
                void navigate(`/login?returnTo=${encodeURIComponent(`/ai?trip=${tripId}`)}`)
              }
            >
              {t('me.login')}
            </Button>
          }
        />
      </div>
    );

  const canRun =
    cats.length > 0 && (mode !== 'text' || text.trim()) && (mode !== 'lodging' || !!lodging);
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('ai.title')} backTo={tripId ? `/trips/${tripId}/plan` : '/'} />
      <div className="flex flex-col gap-3 px-5">
        <SegmentedControl
          label={t('ai.anchor')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'coords', label: t('ai.nearStation') },
            { value: 'lodging', label: t('ai.lodging') },
            { value: 'text', label: t('ai.typeIn') },
          ]}
        />
        {mode === 'text' && (
          <input
            aria-label={t('ai.anchorName')}
            placeholder={t('ai.anchorPlaceholder')}
            value={text}
            maxLength={40}
            onChange={(e) => setText(e.target.value)}
            className="h-12 rounded-btn bg-bg-subtle px-3 text-body-1"
          />
        )}
        {mode === 'lodging' && (
          <p className="text-caption text-fg-sub">{lodging ? lodging.title : t('ai.noLodging')}</p>
        )}
        <div className="flex gap-2">
          {CATS.map((c) => (
            <Chip
              key={c}
              selected={cats.includes(c)}
              onClick={() => setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}
            >
              {t(`ai.cat.${c}`)}
            </Chip>
          ))}
        </div>
        <Button size="lg" fullWidth loading={busy} disabled={!canRun} onClick={() => void run()}>
          <Sparkles aria-hidden="true" className="size-5" />
          {t('ai.run')}
        </Button>
        <p className="text-caption text-fg-muted">{t('ai.disclaimer')}</p>

        {result && (
          <section aria-label={t('ai.results')} className="flex flex-col gap-5 pt-2">
            <p className="text-body-1 font-bold">{t('ai.resultFor', { anchor: result.anchor })}</p>
            {CATS.filter((c) => result.categories[c]).map((c) => {
              const r = result.categories[c]!;
              return (
                <div key={c} className="flex flex-col gap-2">
                  <h2 className="flex items-baseline justify-between">
                    <span className="text-body-1 font-bold">{t(`ai.cat.${c}`)}</span>
                    <span className="text-caption text-fg-muted">
                      {r.months === 1 ? t('ai.period1') : t('ai.periodWider', { n: r.months })}
                    </span>
                  </h2>
                  {r.engine === 'basic' && (
                    <p className="text-caption text-fg-muted">{t('ai.basicNote')}</p>
                  )}
                  {!r.enough && <p className="text-caption text-fg-muted">{t('ai.sparse')}</p>}
                  {r.places.length === 0 ? (
                    <p className="text-body-2 text-fg-sub">{t('ai.none')}</p>
                  ) : (
                    <ol className="flex flex-col gap-2">
                      {r.places.map((p, i) => (
                        <RecCard
                          key={p.name}
                          rec={p}
                          rank={i + 1}
                          tripId={tripId}
                          domestic={domestic}
                        />
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

function RecCard({
  rec,
  rank,
  tripId,
  domestic,
}: {
  rec: Rec;
  rank: number;
  tripId: string;
  domestic: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const kind = rec.category === 'food' ? 'food' : rec.category === 'cafe' ? 'cafe' : 'place';
  const place = rec.place;
  const dest = {
    name: place?.name ?? rec.name,
    ...(place?.address ? { address: place.address } : {}),
    ...(place?.coords ? { coords: place.coords } : {}),
  };
  return (
    <li className="flex flex-col gap-1.5 rounded-card border border-line p-3">
      <div className="flex items-start gap-2">
        <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-primary text-micro font-bold text-on-primary">
          {rank}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-1 font-semibold">
            {rec.name}
            {rec.adSuspect && (
              <span className="ml-1.5 rounded bg-warning/20 px-1 text-micro text-warning">
                {t('ai.adSuspect')}
              </span>
            )}
          </span>
          <span className="text-caption text-fg-sub">
            {t('ai.mentions', {
              n: rec.mentions,
              date: `${rec.lastMentioned.slice(4, 6)}.${rec.lastMentioned.slice(6, 8)}`,
            })}
            {!place && domestic && ` · ${t('ai.unverified')}`}
          </span>
          {rec.summary && <span className="text-body-2 text-fg-sub">{rec.summary}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-1 text-caption font-semibold text-primary"
        >
          {t('ai.sources', { n: rec.sources.length })}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <IconButton
          label={t('placeSearch.openMap', { name: rec.name })}
          icon={<MapPin />}
          onClick={() =>
            openMapLink(placeLink(domestic ? 'naver' : 'google', dest, window.location.hostname))
          }
        />
        <IconButton
          label={t('places.save', { name: rec.name })}
          icon={<Heart />}
          onClick={() =>
            void savedPlaceRepo
              .create({
                name: rec.name,
                kind,
                ...(place?.address ? { address: place.address } : {}),
                ...(place?.coords ? { coords: place.coords, coordsSource: place.source } : {}),
              })
              .then(() => toast(t('places.saved')))
          }
        />
        {tripId && (
          <IconButton
            label={t('places.addToTrip', { name: rec.name })}
            icon={<Plus />}
            tone="tint"
            onClick={() =>
              void itemRepo
                .create({
                  tripId,
                  date: null,
                  kind,
                  title: rec.name,
                  ...(place
                    ? {
                        place: {
                          name: place.name,
                          address: place.address,
                          ...(place.coords
                            ? { coords: place.coords, coordsSource: place.source }
                            : {}),
                        },
                      }
                    : {}),
                })
                .then(() => toast(t('places.added')))
            }
          />
        )}
      </div>
      {open && (
        <ul className="flex flex-col gap-1 border-t border-line pt-2">
          {rec.sources.map((s) => (
            <li key={s.link} className="flex gap-2 text-caption">
              <span className="tabular shrink-0 text-fg-muted">
                {s.postdate.slice(4, 6)}.{s.postdate.slice(6, 8)}
              </span>
              {/* 원문은 텍스트로만 (외부 글을 HTML로 넣지 않음, docs/14 §8) */}
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary"
              >
                {s.title}
              </a>
            </li>
          ))}
          <li className="text-[11px] text-fg-muted">{t('ai.sourceNote')}</li>
        </ul>
      )}
    </li>
  );
}
