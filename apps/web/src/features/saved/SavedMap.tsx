import type { SavedPlace } from '@trippocket/shared';
import { useEffect, useRef, useState } from 'react';
import { mapAllowed, reportMapLoad } from '../../data/api/usage';
import { useSettings } from '../../data/settingsStore';
import { useTranslation } from '../../i18n';
import { chooseProvider, mountMap, type LatLng } from '../../shared/maps';

/** 한국 안 좌표면 국내 (네이버 지도 우선) */
const inKorea = (c: LatLng) => c.lat > 33 && c.lat < 39 && c.lng > 124 && c.lng < 132;

/**
 * 저장한 장소 한 묶음(도시)을 지도에 번호 핀으로 (docs/16 E2).
 * Google 약관: Google에서 받은 좌표는 네이버 지도에 올리지 않는다 (docs/10 §2.1)
 */
export function SavedMap({
  places,
  onSelect,
}: {
  places: readonly SavedPlace[];
  onSelect: (place: SavedPlace) => void;
}) {
  const { t } = useTranslation();
  const el = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'paused'>('loading');
  const pref = useSettings((s) => s.inAppMap);
  const withCoords = places.filter((p) => p.coords);
  const domestic = withCoords.length > 0 && withCoords.every((p) => inKorea(p.coords!));
  const provider = chooseProvider(pref, domestic);
  const visible = withCoords.filter((p) => !(provider === 'naver' && p.coordsSource === 'google'));
  const online = typeof navigator === 'undefined' || navigator.onLine;

  const latest = useRef({ visible, onSelect });
  useEffect(() => {
    latest.current = { visible, onSelect };
  });
  const signature = visible.map((p) => p.id).join('|');

  useEffect(() => {
    if (!provider || !online || !el.current || latest.current.visible.length === 0) return;
    let alive = true;
    const target = el.current;
    let destroy: (() => void) | undefined;
    void mapAllowed(provider).then((ok) => {
      if (!alive) return;
      if (!ok) return setStatus('paused');
      const { visible, onSelect } = latest.current;
      mountMap(provider, target, { center: visible[0]!.coords!, zoom: 12 }).then(
        (h) => {
          if (!alive) return h.destroy();
          destroy = () => h.destroy();
          reportMapLoad(provider);
          const color =
            getComputedStyle(document.documentElement).getPropertyValue('--tp-primary').trim() ||
            '#2160f0';
          h.setMarkers(
            visible.map((p, n) => ({
              id: p.id,
              position: p.coords!,
              label: String(n + 1),
              color,
              title: p.name,
            })),
          );
          h.fitBounds(visible.map((p) => p.coords!));
          h.onMarkerClick((id) => {
            const place = visible.find((p) => p.id === id);
            if (place) onSelect(place);
          });
          setStatus('ready');
        },
        () => alive && setStatus('error'),
      );
    });
    return () => {
      alive = false;
      destroy?.();
    };
  }, [provider, online, signature]);

  const notice =
    visible.length === 0
      ? t('saved.mapNoCoords')
      : !online
        ? t('map.offline')
        : !provider
          ? t('map.noKey')
          : status === 'error'
            ? t('map.error')
            : status === 'paused'
              ? t('map.paused')
              : null;

  return (
    <div className="relative h-[55vh] overflow-hidden rounded-2xl bg-bg-subtle">
      <div ref={el} className="absolute inset-0" />
      {notice && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-body-2 whitespace-pre-line text-fg-muted">
          {notice}
        </p>
      )}
    </div>
  );
}
