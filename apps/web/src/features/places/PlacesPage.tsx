import {
  getTripStatus,
  SAVED_PLACES_MAX,
  todayIn,
  type ItemKind,
  type PlaceSummary,
  type SavedPlace,
  type Trip,
} from '@trippocket/shared';
import { attachFallback } from '../../data/limitNotice';
import { placeSearchLinks, type FallbackLink } from '../../shared/lib/fallbackLinks';
import { FallbackLinks } from '../common/FallbackLinks';
import { Heart, MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { canEditTrip } from '../../data/tripRoles';
import { placesApi, resolvePlace } from '../../data/api/places';
import { useAuth } from '../../data/authStore';
import { useSavedPlaces, useTrip, useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { SavedLimitError, savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { isDomesticTrip } from '../../domain/tripPlace';
import { ServerOfflineNotice } from '../common/ServerOfflineNotice';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { BottomSheet, Button, Chip, IconButton, toast, ScrollRow } from '../../shared/ui';
import { cn } from '../../shared/lib/cn';

const CATEGORIES: { kind: ItemKind; key: 'food' | 'cafe' | 'place' | 'shopping' | 'lodging' }[] = [
  { kind: 'food', key: 'food' },
  { kind: 'cafe', key: 'cafe' },
  { kind: 'place', key: 'place' },
  { kind: 'shopping', key: 'shopping' },
  { kind: 'lodging', key: 'lodging' },
];

/**
 * S-14 장소 찾기 (18단계): 카테고리 + 검색 → 일정의 '가고 싶은 곳'에 담기 / 저장 / 지도.
 * 평점·영업시간은 일정에 담은 뒤 일정 편집에서 [영업시간·평점 보기] (Google 무료 사용량 아끼기, docs/10 §6.2)
 * 2026-10-27 사용자 요청:
 * - 하트 = 저장 탭에 바로 반영(채운 하트), 한 번 더 누르면 저장 취소
 * - [+]는 이 나라로 가는(끝나지 않은·고칠 수 있는) 여행이 있을 때만. 여럿이면 여행을 골라 그 여행의 '가고 싶은 곳'에
 */
export function PlacesPage() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const trips = useTrips();
  const saved = useSavedPlaces() ?? [];
  // [+]를 고를 여행 (여럿일 때 시트)
  const [picking, setPicking] = useState<PlaceSummary | null>(null);
  const loggedIn = useAuth((s) => s.status === 'user');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [results, setResults] = useState<PlaceSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  // 한도로 검색이 막히면 지도 서비스에서 직접 (사용자 요청 2026-10-25)
  const [limitLinks, setLimitLinks] = useState<FallbackLink[]>([]);
  if (!trip) return null;
  const city = trip.destinations[0]?.name ?? '';
  // 저장할 때 나라도 같이 (저장 탭 나라 칸·일정 추가에서 그 나라만 보여 주기)
  const country = trip.destinations[0]?.countryCode;
  const near = trip.destinations.find((d) => d.coords)?.coords;
  // 담을 수 있는 여행: 이 나라로 가는, 아직 안 끝난, 내가 고칠 수 있는 여행 (가까운 순)
  const targets = (trips ?? [])
    .filter(
      (tr) =>
        tr.destinations.some((d) => (country ? d.countryCode === country : tr.id === tripId)) &&
        getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) !== 'past' &&
        canEditTrip(tr.id),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const savedOf = (p: PlaceSummary): SavedPlace | undefined =>
    saved.find((s) =>
      p.source === 'google' && s.googlePlaceId
        ? s.googlePlaceId === p.id
        : s.name === p.name && (s.address ?? '') === (p.address ?? ''),
    );

  async function addTo(target: Trip, p0: PlaceSummary) {
    const p = await resolvePlace(p0);
    await itemRepo.create({
      tripId: target.id,
      date: null,
      kind: cat?.kind ?? 'place',
      title: p.name,
      place: toPlaceRef(p),
    });
    toast(target.id === tripId ? t('places.added') : t('places.addedTo', { trip: target.title }));
  }

  async function toggleSave(p0: PlaceSummary) {
    const had = savedOf(p0);
    if (had) {
      await savedPlaceRepo.softDelete(had.id);
      toast(t('places.unsaved'));
      return;
    }
    try {
      const p = await resolvePlace(p0);
      await savedPlaceRepo.create({
        name: p.name,
        kind: cat?.kind ?? 'place',
        ...(p.address ? { address: p.address } : {}),
        ...(p.coords ? { coords: p.coords, coordsSource: p.source } : {}),
        ...(p.source === 'google' ? { googlePlaceId: p.id } : {}),
        ...(city ? { cityTag: city } : {}),
        ...(country ? { countryCode: country } : {}),
      });
      toast(t('places.saved'));
    } catch (e) {
      if (e instanceof SavedLimitError) toast(t('saved.limit', { max: SAVED_PLACES_MAX }));
      else throw e;
    }
  }

  async function run(category = cat, text = q) {
    const query = [text.trim() || city, category ? t(`places.cat.${category.key}`) : '']
      .filter(Boolean)
      .join(' ');
    if (!query) return;
    setBusy(true);
    const r = await placesApi.search(query, isDomesticTrip(trip!) ? 'domestic' : 'overseas', near);
    setBusy(false);
    const limited = !r.ok && (r.status === 429 || r.reason === 'limit');
    setLimitLinks(limited ? placeSearchLinks(query, isDomesticTrip(trip!)) : []);
    if (r.ok) setResults(r.data.places);
    else if (limited) attachFallback(placeSearchLinks(query, isDomesticTrip(trip!)));
    else toast(t('places.failed'));
  }

  const toPlaceRef = (p: PlaceSummary) => ({
    name: p.name,
    ...(p.address ? { address: p.address } : {}),
    ...(p.coords ? { coords: p.coords, coordsSource: p.source } : {}),
    ...(p.source === 'google'
      ? { googlePlaceId: p.id, coordsFetchedAt: new Date().toISOString() }
      : {}),
    ...(p.url && p.source !== 'google' ? { externalUrl: p.url } : {}),
  });

  if (!loggedIn) return <ServerOfflineNotice />;

  return (
    <div className="flex flex-col gap-3 px-5 pt-3">
      <form
        className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Search aria-hidden="true" className="size-[18px] text-fg-muted" />
        <input
          type="search"
          aria-label={t('places.search')}
          placeholder={t('places.searchPlaceholder', { city })}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-body-1 outline-none"
        />
        <Button size="sm" type="submit" loading={busy}>
          {t('places.go')}
        </Button>
      </form>
      <ScrollRow className="flex gap-2 pt-1.5 pb-1">
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            selected={cat?.key === c.key}
            onClick={() => {
              const next = cat?.key === c.key ? null : c;
              setCat(next);
              void run(next);
            }}
          >
            {t(`places.cat.${c.key}`)}
          </Chip>
        ))}
      </ScrollRow>

      {limitLinks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-caption text-fg-muted">{t('placeSearch.limit')}</p>
          <FallbackLinks links={limitLinks} />
        </div>
      )}
      {results === null ? (
        <p className="text-caption text-fg-muted">{t('places.hint', { city })}</p>
      ) : results.length === 0 ? (
        <p className="text-body-2 text-fg-sub">{t('placeSearch.none')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {results.map((p) => (
            <li key={`${p.source}:${p.id}`} className="flex items-center gap-1 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-2 font-medium">{p.name}</span>
                <span className="truncate text-caption text-fg-muted">
                  {[p.category, p.address].filter(Boolean).join(' · ')}
                </span>
              </span>
              <IconButton
                label={t('placeSearch.openMap', { name: p.name })}
                icon={<MapPin />}
                onClick={() =>
                  openMapLink(
                    placeLink(
                      p.source === 'osm' ? 'google' : p.source,
                      {
                        name: p.name,
                        address: p.address,
                        ...(p.coords ? { coords: p.coords } : {}),
                        ...(p.source === 'google' ? { googlePlaceId: p.id } : {}),
                      },
                      window.location.hostname,
                    ),
                  )
                }
              />
              <IconButton
                label={t(savedOf(p) ? 'places.unsave' : 'places.save', { name: p.name })}
                aria-pressed={!!savedOf(p)}
                icon={<Heart className={cn(savedOf(p) && 'fill-danger text-danger')} />}
                onClick={() => void toggleSave(p)}
              />
              <IconButton
                label={t('places.addToTrip', { name: p.name })}
                icon={<Plus />}
                tone="tint"
                disabled={targets.length === 0}
                onClick={() => (targets.length === 1 ? void addTo(targets[0]!, p) : setPicking(p))}
              />
            </li>
          ))}
        </ul>
      )}
      {results !== null && targets.length === 0 && (
        <p className="text-caption text-fg-muted">{t('places.noTrip')}</p>
      )}

      <BottomSheet
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        title={t('places.pickTrip')}
      >
        <ul className="flex flex-col divide-y divide-line pb-2">
          {targets.map((tr) => (
            <li key={tr.id}>
              <button
                type="button"
                onClick={() => {
                  const p = picking;
                  setPicking(null);
                  if (p) void addTo(tr, p);
                }}
                className="flex min-h-12 w-full items-center gap-2 py-2 text-left"
              >
                <span aria-hidden="true">{tr.cover.emoji ?? '🧳'}</span>
                <span className="min-w-0 flex-1 truncate text-body-1">{tr.title}</span>
                <span className="tabular shrink-0 text-caption text-fg-muted">
                  {tr.startDate.slice(5).replace('-', '.')}~{tr.endDate.slice(5).replace('-', '.')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
