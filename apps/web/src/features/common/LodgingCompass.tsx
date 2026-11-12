import {
  addDays,
  distanceKm,
  formatDistance,
  todayIn,
  type LatLng,
  type Trip,
} from '@trippocket/shared';
import { BedDouble, Navigation2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTripBookings, useTripItems } from '../../data/hooks';
import { useLab } from '../../data/labsStore';
import { arrowDeg, bearingDeg } from '../../domain/compass';
import { lodgingForNight } from '../../domain/lodging';
import { useTranslation } from '../../i18n';
import { BottomSheet } from '../../shared/ui';

/** iOS 사파리: 방향 센서 권한을 누를 때 묻는다 */
type IosOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};
type HeadingEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/**
 * 빠른 메뉴 "숙소 방향" (실험실 homeCompass, 2026-11-13): 오늘 밤 숙소(일정표에 넣은 숙소 좌표)까지
 * 거리와 화살표. 길 잃었을 때 인터넷 없이도 — 위치·방향은 이 기기에서만 쓰고 보내거나 저장하지 않는다
 */
export function LodgingCompass({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const on = useLab('homeCompass');
  const items = useTripItems(on ? trip.id : undefined);
  const bookings = useTripBookings(on ? trip.id : undefined);
  const [open, setOpen] = useState(false);
  if (!on || !items || !bookings) return null;
  // 오늘 밤 숙소, 없으면(귀국 날 등) 어젯밤 숙소
  const today = todayIn(trip.timezone);
  const night = lodgingForNight(bookings, today) ?? lodgingForNight(bookings, addDays(today, -1));
  const coords = night
    ? items.find((i) => i.bookingId === night.booking.id && i.place?.coords)?.place?.coords
    : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 items-center gap-2 rounded-card bg-bg-subtle px-3 text-left"
      >
        <Navigation2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="flex-1 text-body-2 font-semibold">{t('compass.title')}</span>
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title={t('compass.title')}>
        {open &&
          (night && coords ? (
            <Compass name={night.booking.title} target={coords} />
          ) : (
            <p className="py-6 text-center text-body-2 whitespace-pre-line text-fg-muted">
              {t('compass.noLodging')}
            </p>
          ))}
      </BottomSheet>
    </>
  );
}

function Compass({ name, target }: { name: string; target: LatLng }) {
  const { t } = useTranslation();
  const [here, setHere] = useState<LatLng | null>(null);
  const [failed, setFailed] = useState(() => !('geolocation' in navigator));
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setFailed(true),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    const onTurn = (e: Event) => {
      const ev = e as HeadingEvent;
      if (typeof ev.webkitCompassHeading === 'number') setHeading(ev.webkitCompassHeading);
      else if (ev.absolute && ev.alpha !== null) setHeading((360 - ev.alpha) % 360);
    };
    window.addEventListener('deviceorientationabsolute', onTurn);
    window.addEventListener('deviceorientation', onTurn);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onTurn);
      window.removeEventListener('deviceorientation', onTurn);
    };
  }, []);

  const askSensor = async () => {
    const req = (window.DeviceOrientationEvent as IosOrientation | undefined)?.requestPermission;
    if (req) await req().catch(() => 'denied');
  };

  if (failed)
    return (
      <p className="py-6 text-center text-body-2 whitespace-pre-line text-fg-muted">
        {t('compass.noLocation')}
      </p>
    );
  if (!here)
    return <p className="py-6 text-center text-body-2 text-fg-muted">{t('compass.locating')}</p>;
  const bearing = bearingDeg(here, target);
  const deg = heading === null ? bearing : arrowDeg(bearing, heading);
  return (
    <div className="flex flex-col items-center gap-4 pb-4">
      <div className="relative grid size-48 place-items-center rounded-full border border-line bg-bg-subtle">
        {heading === null && (
          <span className="absolute top-2 text-caption font-semibold text-fg-muted">N</span>
        )}
        <Navigation2
          aria-hidden="true"
          className="size-20 fill-primary text-primary transition-transform"
          style={{ transform: `rotate(${deg}deg)` }}
        />
      </div>
      <p className="flex items-center gap-1.5 text-title-2 font-semibold">
        <BedDouble aria-hidden="true" className="size-5 shrink-0 text-fg-sub" />
        <span className="tabular">{formatDistance(distanceKm(here, target))}</span>
      </p>
      <p className="text-center text-body-2 text-fg-sub">{name}</p>
      {heading === null && (
        <button
          type="button"
          onClick={() => void askSensor()}
          className="text-caption whitespace-pre-line text-fg-muted underline"
        >
          {t('compass.noHeading')}
        </button>
      )}
      <p className="text-caption text-fg-muted">{t('compass.note')}</p>
    </div>
  );
}
