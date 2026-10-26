import { phraseLangFor, placeLangFor } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { placesApi } from '../../data/api/places';
import { useTranslation } from '../../i18n';
import { ShowCard } from './ShowCard';

/**
 * 택시 기사에게 보여 주는 카드 (docs/20 G4): "여기로 가 주세요"(현지어) + 장소 이름·주소.
 * Google로 고른 장소면 현지어 이름·주소를 그때 받아 보여 준다 (저장하지 않음 — Google 약관).
 * 오프라인이거나 다른 출처면 저장된 이름·주소
 */
export function TaxiCard({
  open,
  onClose,
  countryCode,
  name,
  address,
  googlePlaceId,
  coords,
}: {
  open: boolean;
  onClose: () => void;
  countryCode: string | undefined;
  name: string;
  address?: string | undefined;
  googlePlaceId?: string | undefined;
  /**
   * Google 무료량이 끝났을 때 백업(Geoapify)용 좌표. Google에서 받은 좌표는 넘기지 않는다 (Google 약관 — 다른 서비스에 쓰지 않음)
   */
  coords?: { lat: number; lng: number } | undefined;
}) {
  const { t } = useTranslation();
  const lang = phraseLangFor(countryCode);
  const placeLang = placeLangFor(countryCode);
  const [local, setLocal] = useState<{ key: string; name?: string; address?: string } | null>(null);
  const key = `${googlePlaceId}|${coords?.lat},${coords?.lng}|${placeLang}`;

  useEffect(() => {
    if (!open || (!googlePlaceId && !coords) || !placeLang || navigator.onLine === false) return;
    let alive = true;
    void placesApi
      .localName({
        ...(googlePlaceId ? { placeId: googlePlaceId } : {}),
        ...(coords ? { coords } : {}),
        lang: placeLang,
      })
      .then((r) => {
        if (alive && r.ok) setLocal({ key, ...r.data });
      });
    return () => {
      alive = false;
    };
  }, [open, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const l = local?.key === key ? local : null;
  return (
    <ShowCard
      open={open}
      onClose={onClose}
      big={lang?.phrases.takeMeHere ?? t('phrases.takeMeHereEn')}
      sub={t('phrases.taxiSub')}
    >
      <div className="flex flex-col gap-2">
        <p className="text-title-1">{l?.name ?? name}</p>
        {(l?.address ?? address) && (
          <p className="text-body-1 text-fg-sub">{l?.address ?? address}</p>
        )}
        {l?.name && l.name !== name && <p className="text-caption text-fg-muted">{name}</p>}
      </div>
    </ShowCard>
  );
}
