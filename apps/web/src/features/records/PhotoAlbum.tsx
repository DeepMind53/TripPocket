import { COUNTRY_CURRENCY } from '@trippocket/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText, Tags } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { photoRepo } from '../../data/repositories/photoRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { photoNames } from '../../data/services/photoVision';
import { PHOTO_TAGS, photoTag, type PhotoTag } from '../../domain/photoTags';
import { useTranslation } from '../../i18n';
import { Button, Chip, ScrollRow, toast } from '../../shared/ui';
import { PhotoViewer } from '../photos/PhotoViewer';

type Filter = PhotoTag | 'all' | 'receipt';

/**
 * 기록 탭 "사진 모아보기" (ADR-0012): 이 기기에 저장한 사진·영수증 전부.
 * 2026-11-12 사용자 요청 — 일정을 지우면 사진을 지울 곳이 없었다 → 사진이 있으면 늘 보이고, 누르면 사진 창(지우기·옮기기·영수증 분석).
 * 일정이 지워진 사진에는 "일정 없음" 표시. 음식·풍경 등 분류([분류하기])는 실험실 photoLabels를 켰을 때만 (누를 때만 보냄, 하루 60장)
 */
export function PhotoAlbum() {
  const { t } = useTranslation();
  const labels = useLab('photoLabels');
  const all = useLiveQuery(() => photoRepo.listAll(), []);
  const tripIds = useMemo(() => [...new Set((all ?? []).map((p) => p.tripId))], [all]);
  // 사진이 붙은 일정이 아직 있는지 (지운 일정은 목록에 없다)
  const liveItems = useLiveQuery(
    async () => new Set((await itemRepo.listByTrips(tripIds)).map((i) => i.id)),
    [tripIds],
  );
  // 영수증 분석 통화 = 그 여행 나라
  const currencies = useLiveQuery(async () => {
    const trips = await Promise.all(tripIds.map((id) => tripRepo.get(id)));
    return new Map(
      trips.flatMap((tr) => {
        const cc = tr?.destinations.find((d) => d.countryCode)?.countryCode;
        return tr && cc ? [[tr.id, COUNTRY_CURRENCY[cc]] as const] : [];
      }),
    );
  }, [tripIds]);
  const photos = useMemo(() => (all ?? []).filter((p) => p.kind === 'photo'), [all]);
  const receipts = useMemo(() => (all ?? []).filter((p) => p.kind === 'receipt'), [all]);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const urls = useMemo(
    () => new Map((all ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)])),
    [all],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!all || all.length === 0) return null;
  const todo = photos.filter((p) => !p.tag);
  const shown =
    filter === 'all'
      ? all
      : filter === 'receipt'
        ? receipts
        : photos.filter((p) => p.tag === filter);
  const count = (k: PhotoTag) => photos.filter((p) => p.tag === k).length;
  const open = all.find((p) => p.id === openId) ?? null;

  const classify = async () => {
    setBusy(true);
    try {
      for (const p of todo) {
        const r = await photoNames(p.blob, 'labels');
        if (r === 'limit') return toast(t('album.limit'));
        if (r === 'unavailable') return toast(t('album.failed'));
        await photoRepo.setTag(p.id, photoTag(r.names));
      }
      toast(t('album.done'));
    } finally {
      setBusy(false);
    }
  };

  const chip = (value: Filter, label: string) => (
    <Chip
      key={value}
      role="radio"
      aria-checked={filter === value}
      selected={filter === value}
      onClick={() => setFilter(value)}
    >
      {label}
    </Chip>
  );

  return (
    <section aria-label={t('album.title')} className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between text-body-1 font-semibold">
        {t('album.title')}
        <span className="text-micro font-normal text-fg-muted">{t('photos.localOnly')}</span>
      </h2>
      <ScrollRow role="radiogroup" aria-label={t('album.title')} className="flex gap-2">
        {chip('all', t('album.all', { n: all.length }))}
        {receipts.length > 0 && chip('receipt', t('album.receipts', { n: receipts.length }))}
        {PHOTO_TAGS.filter((k) => count(k) > 0).map((k) =>
          chip(k, t(`album.tag.${k}`, { n: count(k) })),
        )}
      </ScrollRow>
      <ul className="grid grid-cols-4 gap-1.5">
        {shown.map((p, i) => {
          const orphan = liveItems !== undefined && !liveItems.has(p.itemId);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                aria-label={[
                  t('photos.openN', {
                    kind: t(p.kind === 'receipt' ? 'photos.receipt' : 'photos.photo'),
                    n: i + 1,
                  }),
                  orphan ? t('album.orphan') : '',
                ]
                  .filter(Boolean)
                  .join(', ')}
                className="relative block aspect-square w-full overflow-hidden rounded-btn bg-bg-subtle"
              >
                <img
                  src={urls.get(p.id)}
                  alt=""
                  className={orphan ? 'size-full object-cover opacity-60' : 'size-full object-cover'}
                />
                {p.kind === 'receipt' && (
                  <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-full bg-surface/90">
                    <ReceiptText aria-hidden="true" className="size-4 text-primary" />
                  </span>
                )}
                {orphan && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1 top-1 truncate rounded bg-surface/90 px-1 text-micro text-fg-sub"
                  >
                    {t('album.orphan')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {labels && todo.length > 0 && (
        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            fullWidth
            loading={busy}
            leading={<Tags aria-hidden="true" className="size-4" />}
            onClick={() => void classify()}
          >
            {t('album.classify', { n: todo.length })}
          </Button>
          <p className="text-micro text-fg-muted">{t('album.note')}</p>
        </div>
      )}
      {open && (
        <PhotoViewer
          photo={open}
          url={urls.get(open.id) ?? ''}
          tripId={open.tripId}
          currency={currencies?.get(open.tripId)}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
