import type { ItemKind, PlaceSummary } from '@trippocket/shared';
import { attachFallback } from '../../data/limitNotice';
import { placeSearchLinks, type FallbackLink } from '../../shared/lib/fallbackLinks';
import { FallbackLinks } from '../common/FallbackLinks';
import { Heart, MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useCanEdit } from '../../data/tripRoles';
import { placesApi } from '../../data/api/places';
import { useAuth } from '../../data/authStore';
import { useTrip } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { isDomesticTrip } from '../../domain/tripPlace';
import { ServerOfflineNotice } from '../common/ServerOfflineNotice';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { Button, Chip, IconButton, toast, ScrollRow } from '../../shared/ui';

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
 */
export function PlacesPage() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  // 보기 전용 여행이면 "일정에 추가"를 숨긴다 (저장한 장소는 내 것이라 그대로)
  const canEdit = useCanEdit(tripId);
  const trip = useTrip(tripId);
  const loggedIn = useAuth((s) => s.status === 'user');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [results, setResults] = useState<PlaceSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  // 한도로 검색이 막히면 지도 서비스에서 직접 (사용자 요청 2026-10-25)
  const [limitLinks, setLimitLinks] = useState<FallbackLink[]>([]);
  if (!trip) return null;
  const city = trip.destinations[0]?.name ?? '';
  const near = trip.destinations.find((d) => d.coords)?.coords;

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
                      p.source === 'google' ? 'google' : p.source,
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
                label={t('places.save', { name: p.name })}
                icon={<Heart />}
                onClick={() =>
                  void savedPlaceRepo
                    .create({
                      name: p.name,
                      kind: cat?.kind ?? 'place',
                      ...(p.address ? { address: p.address } : {}),
                      ...(p.coords ? { coords: p.coords, coordsSource: p.source } : {}),
                      ...(p.source === 'google' ? { googlePlaceId: p.id } : {}),
                      ...(city ? { cityTag: city } : {}),
                    })
                    .then(() => toast(t('places.saved')))
                }
              />
              {canEdit && (
                <IconButton
                  label={t('places.addToTrip', { name: p.name })}
                  icon={<Plus />}
                  tone="tint"
                  onClick={() =>
                    void itemRepo
                      .create({
                        tripId,
                        date: null,
                        kind: cat?.kind ?? 'place',
                        title: p.name,
                        place: toPlaceRef(p),
                      })
                      .then(() => toast(t('places.added')))
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
