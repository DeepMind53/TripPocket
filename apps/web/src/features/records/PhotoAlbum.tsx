import { useLiveQuery } from 'dexie-react-hooks';
import { Tags } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLab } from '../../data/labsStore';
import { photoRepo } from '../../data/repositories/photoRepo';
import { photoNames } from '../../data/services/photoVision';
import { PHOTO_TAGS, photoTag, type PhotoTag } from '../../domain/photoTags';
import { useTranslation } from '../../i18n';
import { Button, Chip, ScrollRow, toast } from '../../shared/ui';

/**
 * 기록 탭 "사진 모아보기" (실험실 photoLabels, ADR-0012 — 2026-11-11): 일정에 붙인 사진(영수증 빼고)을
 * 음식·풍경·건물·사람·기타로. [분류하기]를 누를 때만 아직 안 나눈 사진을 한 장씩 보낸다 (한 사람 하루 60장)
 */
export function PhotoAlbum() {
  const { t } = useTranslation();
  const on = useLab('photoLabels');
  const all = useLiveQuery(() => photoRepo.listAll(), []);
  const photos = useMemo(() => (all ?? []).filter((p) => p.kind === 'photo'), [all]);
  const [tag, setTag] = useState<PhotoTag | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const urls = useMemo(
    () => new Map(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])),
    [photos],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!on || photos.length === 0) return null;
  const todo = photos.filter((p) => !p.tag);
  const shown = tag === 'all' ? photos : photos.filter((p) => p.tag === tag);
  const count = (k: PhotoTag) => photos.filter((p) => p.tag === k).length;

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

  return (
    <section aria-label={t('album.title')} className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between text-body-1 font-semibold">
        {t('album.title')}
        <span className="text-micro font-normal text-fg-muted">{t('photos.localOnly')}</span>
      </h2>
      <ScrollRow role="radiogroup" aria-label={t('album.title')} className="flex gap-2">
        <Chip
          role="radio"
          aria-checked={tag === 'all'}
          selected={tag === 'all'}
          onClick={() => setTag('all')}
        >
          {t('album.all', { n: photos.length })}
        </Chip>
        {PHOTO_TAGS.filter((k) => count(k) > 0).map((k) => (
          <Chip
            key={k}
            role="radio"
            aria-checked={tag === k}
            selected={tag === k}
            onClick={() => setTag(k)}
          >
            {t(`album.tag.${k}`, { n: count(k) })}
          </Chip>
        ))}
      </ScrollRow>
      <ul className="grid grid-cols-4 gap-1.5">
        {shown.map((p) => (
          <li key={p.id} className="aspect-square overflow-hidden rounded-btn bg-bg-subtle">
            <img src={urls.get(p.id)} alt="" className="size-full object-cover" />
          </li>
        ))}
      </ul>
      {todo.length > 0 && (
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
    </section>
  );
}
