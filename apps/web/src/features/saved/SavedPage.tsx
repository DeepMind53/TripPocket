import {
  findCityByName,
  flagEmoji,
  getTripStatus,
  SAVED_PLACES_MAX,
  todayIn,
  type SavedPlace,
} from '@trippocket/shared';
import { Map as MapIcon, MapPin, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSavedPlaces, useTrips } from '../../data/hooks';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { countryGroups, UNKNOWN_COUNTRY } from '../../domain/savedCountries';
import { useTranslation } from '../../i18n';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { cn } from '../../shared/lib/cn';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import {
  BottomSheet,
  Button,
  confirmDelete,
  EmptyState,
  IconButton,
  snackbar,
  TopBar,
} from '../../shared/ui';

// 지도는 열 때만 (첫 화면 크기)
const SavedMap = lazy(() => import('./SavedMap').then((m) => ({ default: m.SavedMap })));

/** 처음 보이는 나라 칸 수 (3×3) — 넘으면 "+ 더보기" */
const GRID = 9;

const openPlace = (p: SavedPlace) =>
  openMapLink(
    placeLink(
      p.googlePlaceId ? 'google' : 'naver',
      {
        name: p.name,
        ...(p.address ? { address: p.address } : {}),
        ...(p.coords ? { coords: p.coords } : {}),
        ...(p.googlePlaceId ? { googlePlaceId: p.googlePlaceId } : {}),
      },
      window.location.hostname,
    ),
  );

/** 나라 이름 (브라우저가 아는 이름) */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * S-04 저장한 장소 — 일정과 따로 관리하는 개인 목록 (사용자 요청 2026-10-26).
 * 나라 칸(3×3, 많은 나라 먼저, 넘치면 더보기)을 고르면 아래에 그 나라 장소. 일정을 세울 때는
 * 일정 추가 화면에서 그 여행 나라의 저장 장소만 골라 넣는다. 한 사람 200곳까지
 */
export function SavedPage() {
  const { t } = useTranslation();
  const places = useSavedPlaces();
  const trips = useTrips();
  const navigate = useNavigate();
  const [mapOpen, setMapOpen] = useRouteSheet('saved-map');
  const [picked, setPicked] = useState<SavedPlace | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // 나라 코드 없이 저장된 예전 장소는 도시 이름으로 나라를 채운다 (도시 데이터는 이 화면에서만)
  useEffect(() => {
    void savedPlaceRepo.fillCountries((city) => findCityByName(city)?.countryCode);
  }, []);

  const groups = countryGroups(places ?? []);
  const current = groups.find((g) => g.code === selected) ?? groups[0];
  const list = (places ?? []).filter((p) => (p.countryCode ?? UNKNOWN_COUNTRY) === current?.code);
  const label = (code: string) =>
    code === UNKNOWN_COUNTRY ? t('saved.other') : `${flagEmoji(code)} ${countryName(code)}`;
  const shown = showAll ? groups : groups.slice(0, GRID);

  // 저장이 없을 때: 가까운 여행의 장소 찾기로
  const openTrip = (trips ?? [])
    .filter((tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) !== 'past')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  return (
    <>
      <TopBar title={t('saved.title')} />
      {places && places.length === 0 ? (
        <EmptyState
          emoji="❤️"
          title={t('saved.emptyTitle')}
          description={t('saved.emptyDesc')}
          {...(openTrip
            ? {
                action: (
                  <Button size="lg" onClick={() => void navigate(`/trips/${openTrip.id}/places`)}>
                    {t('saved.emptyCta')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="flex flex-col gap-4 px-5 pt-2">
          <p className="tabular text-caption text-fg-muted">
            {t('saved.count', { n: places?.length ?? 0, max: SAVED_PLACES_MAX })}
          </p>
          <section aria-label={t('saved.countries')} className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {shown.map((g) => (
                <button
                  key={g.code || 'unknown'}
                  type="button"
                  aria-pressed={g.code === current?.code}
                  onClick={() => setSelected(g.code)}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center rounded-card border px-1 py-2 text-center',
                    g.code === current?.code
                      ? 'border-primary bg-primary-weak text-primary'
                      : 'border-line bg-surface',
                  )}
                >
                  <span className="w-full truncate text-body-2 font-semibold">{label(g.code)}</span>
                  <span className="tabular text-micro text-fg-muted">
                    {t('saved.countryCount', { n: g.count })}
                  </span>
                </button>
              ))}
            </div>
            {groups.length > GRID && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="mx-auto h-9 rounded-full px-4 text-caption font-semibold text-fg-sub"
              >
                {showAll ? t('saved.less') : t('saved.more', { n: groups.length - GRID })}
              </button>
            )}
          </section>

          {current && (
            <section aria-label={label(current.code)} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <h2 className="flex-1 text-caption font-bold text-fg-muted">
                  {label(current.code)} · {list.length}
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('saved.mapOf', { city: label(current.code) })}
                  onClick={() => {
                    setPicked(null);
                    setMapOpen(true);
                  }}
                >
                  <MapIcon aria-hidden="true" className="size-4" />
                  {t('saved.map')}
                </Button>
              </div>
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-1 py-1.5 pl-4">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-2 font-medium">{p.name}</span>
                      <span className="truncate text-caption text-fg-muted">
                        {[p.cityTag, p.address].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <IconButton
                      label={t('placeSearch.openMap', { name: p.name })}
                      icon={<MapPin />}
                      onClick={() => openPlace(p)}
                    />
                    <IconButton
                      label={t('saved.remove', { name: p.name })}
                      icon={<Trash2 />}
                      onClick={async () => {
                        if (!(await confirmDelete(t('confirm.item', { name: p.name })))) return;
                        void savedPlaceRepo.softDelete(p.id).then(() =>
                          snackbar(t('saved.removed'), {
                            label: t('common.undo'),
                            onAction: () => void savedPlaceRepo.restore(p.id),
                          }),
                        );
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <BottomSheet
        open={mapOpen}
        onOpenChange={setMapOpen}
        title={t('saved.mapTitle', { city: current ? label(current.code) : '' })}
      >
        {current && (
          <div className="flex flex-col gap-3 pb-2">
            <Suspense fallback={<div className="h-[55vh] rounded-2xl bg-bg-subtle" />}>
              <SavedMap places={list} onSelect={setPicked} />
            </Suspense>
            {picked && (
              <button
                type="button"
                onClick={() => openPlace(picked)}
                className="flex flex-col rounded-card border border-line px-4 py-2.5 text-left"
              >
                <span className="text-body-2 font-medium">{picked.name}</span>
                {picked.address && (
                  <span className="text-caption text-fg-muted">{picked.address}</span>
                )}
                <span className="text-caption text-primary">{t('saved.openInMapApp')}</span>
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
