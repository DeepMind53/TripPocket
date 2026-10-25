import { phraseLangFor, placeLangFor } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
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
}: {
  open: boolean;
  onClose: () => void;
  countryCode: string | undefined;
  name: string;
  address?: string | undefined;
  googlePlaceId?: string | undefined;
}) {
  const { t } = useTranslation();
  const lang = phraseLangFor(countryCode);
  const placeLang = placeLangFor(countryCode);
  const [local, setLocal] = useState<{ key: string; name?: string; address?: string } | null>(null);
  const key = `${googlePlaceId}|${placeLang}`;

  useEffect(() => {
    if (!open || !googlePlaceId || !placeLang || navigator.onLine === false) return;
    let alive = true;
    void api<{ name?: string; address?: string }>(
      `/api/places/google/${encodeURIComponent(googlePlaceId)}/local?lang=${encodeURIComponent(placeLang)}`,
    ).then((r) => {
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
