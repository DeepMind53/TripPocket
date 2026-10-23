import { MapPin, Trash2 } from 'lucide-react';
import { useSavedPlaces } from '../../data/hooks';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { EmptyState, IconButton, snackbar, TopBar } from '../../shared/ui';
import { QuickMenuButton } from '../common/QuickMenu';

/** S-04 저장한 장소 — 장소 찾기에서 ♡ 누른 곳 (도시별) */
export function SavedPage() {
  const { t } = useTranslation();
  const places = useSavedPlaces();

  const groups = new Map<string, NonNullable<typeof places>>();
  for (const p of places ?? [])
    groups.set(p.cityTag ?? '', [...(groups.get(p.cityTag ?? '') ?? []), p]);

  return (
    <>
      <TopBar title={t('saved.title')} actions={<QuickMenuButton />} />
      {places && places.length === 0 ? (
        <EmptyState emoji="❤️" title={t('saved.emptyTitle')} description={t('saved.emptyDesc')} />
      ) : (
        <div className="flex flex-col gap-4 px-5 pt-2">
          {[...groups].map(([city, list]) => (
            <section
              key={city}
              aria-label={city || t('saved.other')}
              className="flex flex-col gap-1"
            >
              <h2 className="text-caption font-bold text-fg-muted">{city || t('saved.other')}</h2>
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
                      onClick={() =>
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
                        )
                      }
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
    </>
  );
}
