import { getTripStatus, todayIn, type SavedPlace } from '@trippocket/shared';
import { Map as MapIcon, MapPin, Plus, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSavedPlaces, useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { useTranslation } from '../../i18n';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { formatPeriod } from '../../shared/lib/dateFormat';
import {
  BottomSheet,
  Button,
  EmptyState,
  IconButton,
  snackbar,
  toast,
  TopBar,
} from '../../shared/ui';

// 지도는 열 때만 (첫 화면 크기)
const SavedMap = lazy(() => import('./SavedMap').then((m) => ({ default: m.SavedMap })));

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

/** S-04 저장한 장소 — 장소 찾기에서 ♡ 누른 곳 (도시별, 묶음마다 지도·여행에 담기 — docs/16 E2) */
export function SavedPage() {
  const { t } = useTranslation();
  const places = useSavedPlaces();
  const trips = useTrips();
  const navigate = useNavigate();
  const [mapOpen, setMapOpen] = useRouteSheet('saved-map');
  const [addOpen, setAddOpen] = useRouteSheet('saved-add');
  const [group, setGroup] = useState<{ city: string; list: SavedPlace[] } | null>(null);
  const [picked, setPicked] = useState<SavedPlace | null>(null);

  const groups = new Map<string, SavedPlace[]>();
  for (const p of places ?? [])
    groups.set(p.cityTag ?? '', [...(groups.get(p.cityTag ?? '') ?? []), p]);

  // 담을 수 있는 여행: 끝나지 않은 여행 (가까운 순)
  const openTrips = (trips ?? [])
    .filter((tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) !== 'past')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  async function addTo(tripId: string, title: string) {
    if (!group) return;
    // 날짜 없는 "가고 싶은 곳"으로 — 날짜는 일정 화면에서 정한다
    for (const p of group.list)
      await itemRepo.create({
        tripId,
        date: null,
        kind: p.kind,
        title: p.name,
        place: {
          name: p.name,
          ...(p.address ? { address: p.address } : {}),
          ...(p.coords ? { coords: p.coords } : {}),
          ...(p.coordsSource ? { coordsSource: p.coordsSource } : {}),
          ...(p.coordsFetchedAt ? { coordsFetchedAt: p.coordsFetchedAt } : {}),
          ...(p.googlePlaceId ? { googlePlaceId: p.googlePlaceId } : {}),
          ...(p.naverPlaceUrl ? { naverPlaceUrl: p.naverPlaceUrl } : {}),
        },
        ...(p.memo ? { memo: p.memo } : {}),
      });
    setAddOpen(false);
    toast(t('saved.added', { n: group.list.length, trip: title }));
  }

  return (
    <>
      <TopBar title={t('saved.title')} />
      {places && places.length === 0 ? (
        <EmptyState
          emoji="❤️"
          title={t('saved.emptyTitle')}
          description={t('saved.emptyDesc')}
          {...(openTrips[0]
            ? {
                action: (
                  <Button
                    size="lg"
                    onClick={() => void navigate(`/trips/${openTrips[0]!.id}/places`)}
                  >
                    {t('saved.emptyCta', { trip: openTrips[0].title })}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="flex flex-col gap-4 px-5 pt-2">
          {[...groups].map(([city, list]) => (
            <section
              key={city}
              aria-label={city || t('saved.other')}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center gap-1">
                <h2 className="flex-1 text-caption font-bold text-fg-muted">
                  {city || t('saved.other')} · {list.length}
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('saved.mapOf', { city: city || t('saved.other') })}
                  onClick={() => {
                    setGroup({ city, list });
                    setPicked(null);
                    setMapOpen(true);
                  }}
                >
                  <MapIcon aria-hidden="true" className="size-4" />
                  {t('saved.map')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('saved.addOf', { city: city || t('saved.other') })}
                  onClick={() => {
                    setGroup({ city, list });
                    setAddOpen(true);
                  }}
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {t('saved.addToTrip')}
                </Button>
              </div>
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-1 py-1.5 pl-4">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-2 font-medium">{p.name}</span>
                      {p.address && (
                        <span className="truncate text-caption text-fg-muted">{p.address}</span>
                      )}
                    </span>
                    <IconButton
                      label={t('placeSearch.openMap', { name: p.name })}
                      icon={<MapPin />}
                      onClick={() => openPlace(p)}
                    />
                    <IconButton
                      label={t('saved.remove', { name: p.name })}
                      icon={<Trash2 />}
                      onClick={() =>
                        void savedPlaceRepo.softDelete(p.id).then(() =>
                          snackbar(t('saved.removed'), {
                            label: t('common.undo'),
                            onAction: () => void savedPlaceRepo.restore(p.id),
                          }),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <BottomSheet
        open={mapOpen}
        onOpenChange={setMapOpen}
        title={t('saved.mapTitle', { city: group?.city || t('saved.other') })}
      >
        {group && (
          <div className="flex flex-col gap-3 pb-2">
            <Suspense fallback={<div className="h-[55vh] rounded-2xl bg-bg-subtle" />}>
              <SavedMap places={group.list} onSelect={setPicked} />
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

      <BottomSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('saved.addTitle', { n: group?.list.length ?? 0 })}
      >
        {openTrips.length === 0 ? (
          <p className="py-4 text-center text-body-2 whitespace-pre-line text-fg-muted">
            {t('saved.noTrips')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line pb-2">
            {openTrips.map((tr) => (
              <li key={tr.id}>
                <button
                  type="button"
                  onClick={() => void addTo(tr.id, tr.title)}
                  className="flex w-full flex-col py-3 text-left"
                >
                  <span className="text-body-1 font-medium">{tr.title}</span>
                  <span className="tabular text-caption text-fg-muted">
                    {formatPeriod(tr.startDate, tr.endDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="pb-2 text-caption text-fg-muted">{t('saved.addHint')}</p>
      </BottomSheet>
    </>
  );
}
