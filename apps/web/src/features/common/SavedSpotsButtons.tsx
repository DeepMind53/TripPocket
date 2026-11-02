import { todayIn, type Trip } from '@trippocket/shared';
import { Info, List, MapPin, MapPinPlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isDomesticTrip } from '../../domain/tripPlace';
import {
  addSpot,
  removeSpot,
  syncSpotsTrip,
  useSavedSpots,
  type SavedSpot,
} from '../../data/savedSpots';
import { useSettings } from '../../data/settingsStore';
import { useTranslation } from '../../i18n';
import { openMapLink, placeLink } from '../../shared/lib/directions';
import { BottomSheet, Button, CancelSaveRow, IconButton, toast } from '../../shared/ui';

/** 다른 여행 목록일 때 — 매번 새 배열을 만들면 화면이 끝없이 다시 그려진다 */
const NO_SPOTS: SavedSpot[] = [];

/**
 * 빠른 메뉴 "현재 위치 저장"·"저장한 위치" (사용자 요청 2026-11-02).
 * 이 기기에만, 이번 여행 동안만 — 다른 여행이 시작되면 자동으로 지운다 (data/savedSpots.ts).
 * GPS를 못 잡으면 저장하지 않고 안내 팝업
 */
export function SavedSpotsButtons({
  trip,
  horizontal = false,
}: {
  trip: Trip;
  /** 렌터카 칸이 없으면 두 버튼을 가로로 */
  horizontal?: boolean;
}) {
  const { t } = useTranslation();
  const spots = useSavedSpots((s) => (s.tripId === trip.id ? s.spots : NO_SPOTS));
  const app = useSettings((s) => s.directionsApp);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [gpsFail, setGpsFail] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // 이 여행이 시작됐으면 예전 여행에서 저장한 위치는 지운다
  useEffect(
    () => syncSpotsTrip(trip, todayIn(trip.timezone)),
    [trip.id, trip.startDate, trip.timezone], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function save() {
    if (!name.trim()) return;
    if (!('geolocation' in navigator)) {
      setGpsFail(true);
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        addSpot(trip.id, {
          name: name.trim().slice(0, 40),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setName('');
        setSaveOpen(false);
        toast(t('spots.saved'));
      },
      () => {
        setBusy(false);
        setGpsFail(true);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  const go = (s: { name: string; lat: number; lng: number }) => {
    // 국내 = 설정의 길찾기 앱(매번 묻기면 네이버), 해외 = Google 지도
    const mapApp = isDomesticTrip(trip) ? (app === 'kakao' ? 'kakao' : 'naver') : 'google';
    openMapLink(
      placeLink(
        mapApp,
        { name: s.name, coords: { lat: s.lat, lng: s.lng } },
        window.location.hostname,
      ),
    );
  };

  const notice = (
    <p className="flex items-start gap-1.5 rounded-card bg-warning/15 p-2.5 text-caption whitespace-pre-line text-fg-sub">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      {t('spots.notice')}
    </p>
  );

  return (
    <>
      <div className={horizontal ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="flex min-h-12 items-center gap-2 rounded-card bg-bg-subtle px-3 text-left text-body-2 font-semibold"
        >
          <List aria-hidden="true" className="size-5 shrink-0 text-primary" />
          {t('spots.list', { n: spots.length })}
        </button>
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          className="flex min-h-12 items-center gap-2 rounded-card bg-primary-weak px-3 text-left text-body-2 font-semibold"
        >
          <MapPinPlus aria-hidden="true" className="size-5 shrink-0 text-primary" />
          {t('spots.save')}
        </button>
      </div>

      <BottomSheet
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title={t('spots.save')}
        footer={
          <CancelSaveRow onCancel={() => setSaveOpen(false)}>
            <Button size="lg" fullWidth loading={busy} disabled={!name.trim()} onClick={save}>
              {t('spots.saveHere')}
            </Button>
          </CancelSaveRow>
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          {notice}
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">{t('spots.name')}</span>
            <input
              value={name}
              maxLength={40}
              placeholder={t('spots.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              className="h-12 rounded-btn bg-bg-subtle px-3 text-body-1"
            />
          </label>
        </div>
      </BottomSheet>

      <BottomSheet
        open={listOpen}
        onOpenChange={setListOpen}
        title={t('spots.listTitle')}
        autoFocusInput={false}
      >
        <div className="flex flex-col gap-3 pb-2">
          {notice}
          {spots.length === 0 ? (
            <p className="py-4 text-center text-body-2 text-fg-muted">{t('spots.empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {spots.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go(s)}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MapPin aria-hidden="true" className="size-5 shrink-0 text-primary" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body-2 font-semibold">{s.name}</span>
                      <span className="tabular text-caption text-fg-muted">
                        {new Date(s.savedAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {t('spots.directions')}
                      </span>
                    </span>
                  </button>
                  <IconButton
                    label={t('spots.remove', { name: s.name })}
                    icon={<Trash2 />}
                    onClick={() => removeSpot(s.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={gpsFail}
        onOpenChange={setGpsFail}
        title={t('spots.gpsTitle')}
        description={t('spots.gpsDesc')}
        autoFocusInput={false}
        footer={
          <Button size="lg" fullWidth onClick={() => setGpsFail(false)}>
            {t('common.close')}
          </Button>
        }
      >
        <span />
      </BottomSheet>
    </>
  );
}
