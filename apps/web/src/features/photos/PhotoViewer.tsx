import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { PhotoRow } from '../../data/db';
import { itemRepo } from '../../data/repositories/itemRepo';
import { photoRepo } from '../../data/repositories/photoRepo';
import { readReceipt } from '../../data/services/receiptOcr';
import { parseReceipt } from '../../domain/receipt';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet, Button, confirmDelete, toast } from '../../shared/ui';
import { LandmarkFinder } from './LandmarkFinder';

const money = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

/**
 * 사진 크게 보기 (ADR-0012): 영수증은 [영수증 분석](누를 때만 밖으로) → 읽은 글(고칠 수 있음) → 품목·금액 표(볼 때 계산).
 * 날짜·일정을 골라 다른 일정으로 옮기기, 지우기 (기기에만 있어 되돌릴 수 없음)
 */
export function PhotoViewer({
  photo,
  url,
  tripId,
  currency,
  onClose,
}: {
  photo: PhotoRow;
  url: string;
  tripId: string;
  currency?: string | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(photo.text ?? '');
  const items = useLiveQuery(() => itemRepo.listByTrip(tripId), [tripId]) ?? [];
  const current = items.find((i) => i.id === photo.itemId);
  const [date, setDate] = useState<string>(current?.date ?? '');
  const dates = [...new Set(items.map((i) => i.date ?? ''))].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  );
  const pick = date || (current?.date ?? '');
  const sameDay = items.filter((i) => (i.date ?? '') === pick && i.kind !== 'note');
  const parsed = photo.text !== undefined ? parseReceipt(draft) : null;
  const sum = parsed?.lines.reduce((a, l) => a + l.price, 0) ?? 0;

  const analyze = async () => {
    setBusy(true);
    try {
      const r = await readReceipt(photo.blob, currency);
      await photoRepo.setText(photo.id, r.text, r.source);
      setDraft(r.text);
    } catch {
      toast(t('photos.analyzeFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t(photo.kind === 'receipt' ? 'photos.receipt' : 'photos.photo')}
      description={t('photos.localOnly')}
      autoFocusInput={false}
    >
      <div className="flex flex-col gap-4 pb-2">
        <img src={url} alt="" className="max-h-[50dvh] w-full rounded-card object-contain" />

        {photo.kind === 'receipt' && photo.text === undefined && (
          <div className="flex flex-col gap-1.5">
            <Button fullWidth loading={busy} onClick={() => void analyze()}>
              {busy ? t('photos.analyzing') : t('photos.analyze')}
            </Button>
            <p className="text-caption whitespace-pre-line text-fg-muted">
              {t('photos.analyzeNote')}
            </p>
          </div>
        )}

        {parsed && (
          <section aria-label={t('photos.items')} className="flex flex-col gap-2">
            <h4 className="flex items-baseline justify-between text-body-2 font-semibold">
              {t('photos.items')}
              {photo.textSource && (
                <span className="text-micro font-normal text-fg-muted">
                  {t(`photos.source.${photo.textSource}`)}
                </span>
              )}
            </h4>
            {parsed.lines.length === 0 ? (
              <p className="text-caption whitespace-pre-line text-fg-muted">
                {t('photos.noLines')}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                {parsed.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline gap-3 px-3 py-2 text-body-2">
                    <span className="min-w-0 flex-1 break-words">{l.name}</span>
                    <span className="tabular shrink-0">{money(l.price)}</span>
                  </li>
                ))}
                <li className="flex items-baseline gap-3 bg-bg-subtle px-3 py-2 text-body-2 font-semibold">
                  <span className="flex-1">
                    {parsed.total !== null ? t('photos.total') : t('photos.sum')}
                  </span>
                  <span className="tabular">{money(parsed.total ?? sum)}</span>
                </li>
              </ul>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-fg-sub">{t('photos.text')}</span>
              <textarea
                value={draft}
                rows={6}
                maxLength={5000}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  if (draft !== photo.text)
                    void photoRepo.setText(photo.id, draft, photo.textSource);
                }}
                className="rounded-btn border border-line bg-surface px-3 py-2 text-body-2"
              />
              <span className="text-micro text-fg-muted">{t('photos.textHint')}</span>
            </label>
            {/* 예전에 잘못 읽힌 영수증을 고친 인식으로 다시 읽기 (2026-11-12, 하루 20장에 포함) */}
            <Button
              variant="secondary"
              fullWidth
              loading={busy}
              leading={<RotateCcw aria-hidden="true" className="size-4" />}
              onClick={() => void analyze()}
            >
              {busy ? t('photos.analyzing') : t('photos.reanalyze')}
            </Button>
          </section>
        )}

        {/* 실험실 "사진 속 장소" (2026-11-11) */}
        <LandmarkFinder photo={photo} />

        {/* 다른 일정으로 옮기기: 날짜 → 그날 일정 */}
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-body-2 font-semibold">{t('photos.move')}</legend>
          <div className="grid grid-cols-[auto_1fr] items-center gap-2">
            <label htmlFor="photo-date" className="text-caption text-fg-sub">
              {t('photos.moveDate')}
            </label>
            <select
              id="photo-date"
              value={pick}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-btn border border-line bg-surface px-2 text-body-2"
            >
              {dates.map((d) => (
                <option key={d || 'wish'} value={d}>
                  {d ? formatMonthDay(d) : t('photos.wish')}
                </option>
              ))}
            </select>
            <label htmlFor="photo-item" className="text-caption text-fg-sub">
              {t('photos.moveItem')}
            </label>
            <select
              id="photo-item"
              value={sameDay.some((i) => i.id === photo.itemId) ? photo.itemId : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                void photoRepo.moveTo(photo.id, e.target.value).then(() => {
                  toast(t('photos.moved'));
                  onClose();
                });
              }}
              className="h-11 min-w-0 rounded-btn border border-line bg-surface px-2 text-body-2"
            >
              <option value="" disabled>
                —
              </option>
              {sameDay.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.startTime ? `${i.startTime} ${i.title}` : i.title}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <Button
          variant="ghost"
          fullWidth
          leading={<Trash2 aria-hidden="true" className="size-4" />}
          onClick={() =>
            void confirmDelete(t('photos.deleteConfirm')).then((ok) => {
              if (!ok) return;
              void photoRepo.remove(photo.id);
              onClose();
            })
          }
        >
          {t('photos.delete')}
        </Button>
      </div>
    </BottomSheet>
  );
}
