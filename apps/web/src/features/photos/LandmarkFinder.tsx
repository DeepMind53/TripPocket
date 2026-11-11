import type { VisionNames } from '@trippocket/shared';
import { MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import type { PhotoRow } from '../../data/db';
import { useLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { photoNames } from '../../data/services/photoVision';
import { useTranslation } from '../../i18n';
import { Button, toast } from '../../shared/ui';

/**
 * 사진 속 장소 알아보기 (실험실 photoLandmark, ADR-0012 — 2026-11-11): 누를 때만 그 사진을 보내 장소 이름을 받는다.
 * [가고 싶은 곳에 넣기]는 이름만 — Google 좌표는 Google 지도에만 쓸 수 있어 넣지 않는다 (docs/10 §2.1)
 */
export function LandmarkFinder({ photo }: { photo: PhotoRow }) {
  const { t } = useTranslation();
  const on = useLab('photoLandmark');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<VisionNames['names'] | null>(null);
  if (!on || photo.kind !== 'photo') return null;

  const find = async () => {
    setBusy(true);
    try {
      const r = await photoNames(photo.blob, 'landmark');
      if (r === 'limit') toast(t('landmark.limit'));
      else if (r === 'unavailable') toast(t('landmark.failed'));
      else setFound(r.names.slice(0, 3));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t('landmark.title')} className="flex flex-col gap-2">
      {found === null ? (
        <Button
          variant="secondary"
          fullWidth
          loading={busy}
          leading={<MapPin aria-hidden="true" className="size-4" />}
          onClick={() => void find()}
        >
          {t('landmark.find')}
        </Button>
      ) : found.length === 0 ? (
        <p className="text-caption whitespace-pre-line text-fg-muted">{t('landmark.none')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {found.map((f) => (
            <li key={f.name} className="flex items-center gap-2 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-2 font-medium">{f.name}</span>
                <span className="tabular text-micro text-fg-muted">
                  {t('landmark.score', { n: Math.round(f.score * 100) })}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                leading={<Plus aria-hidden="true" className="size-4" />}
                aria-label={t('landmark.addOf', { name: f.name })}
                onClick={() =>
                  void itemRepo
                    .create({ tripId: photo.tripId, date: null, kind: 'place', title: f.name })
                    .then(() => toast(t('landmark.added', { name: f.name })))
                }
              >
                {t('landmark.add')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-micro text-fg-muted">{t('landmark.note')}</p>
    </section>
  );
}
