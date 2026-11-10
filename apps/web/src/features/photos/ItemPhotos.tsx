import type { ItineraryItem } from '@trippocket/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { photoRepo } from '../../data/repositories/photoRepo';
import { useTranslation } from '../../i18n';
import { PhotoViewer } from './PhotoViewer';

/**
 * 일정 상세 "사진·영수증" (실험실, ADR-0012 — 2026-11-11): 이 일정에 붙은 사진을 작게, 누르면 크게·영수증 분석·옮기기.
 * 붙은 사진이 있을 때만 보이고, 실험을 꺼도 이미 붙은 사진은 보인다 (기기에만 있으니 찾을 수 있게)
 */
export function ItemPhotos({
  item,
  currency,
}: {
  item: ItineraryItem;
  currency?: string | undefined;
}) {
  const { t } = useTranslation();
  const photos = useLiveQuery(() => photoRepo.listByItem(item.id), [item.id]);
  const [openId, setOpenId] = useState<string | null>(null);
  // 작은 그림 주소 — 목록이 바뀌면 새로 만들고 예전 것은 풀어 준다
  const urls = useMemo(
    () => new Map((photos ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)])),
    [photos],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!photos || photos.length === 0) return null;
  const open = photos.find((p) => p.id === openId) ?? null;
  return (
    <section aria-label={t('photos.title')} className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between text-body-2 font-semibold">
        {t('photos.title')}
        <span className="text-micro font-normal text-fg-muted">{t('photos.localOnly')}</span>
      </h3>
      <ul className="grid grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpenId(p.id)}
              aria-label={t('photos.openN', {
                kind: t(p.kind === 'receipt' ? 'photos.receipt' : 'photos.photo'),
                n: i + 1,
              })}
              className="relative block aspect-square w-full overflow-hidden rounded-btn bg-bg-subtle"
            >
              <img src={urls.get(p.id)} alt="" className="size-full object-cover" />
              {p.kind === 'receipt' && (
                <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-full bg-surface/90">
                  <ReceiptText aria-hidden="true" className="size-4 text-primary" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <PhotoViewer
          photo={open}
          url={urls.get(open.id) ?? ''}
          tripId={item.tripId}
          currency={currency}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
