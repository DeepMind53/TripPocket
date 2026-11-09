import type { Booking, Trip } from '@trippocket/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, FileText, Image as ImageIcon, Paperclip, Pencil, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AttachmentRow } from '../../data/db';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { useTranslation } from '../../i18n';
import { openBlob } from '../../shared/lib/openBlob';
import { IconButton, toast } from '../../shared/ui';
import { confirmDelete } from '../../shared/ui';

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)}MB`;

const openDoc = (row: AttachmentRow) => openBlob(row.blob);

/**
 * 예약 문서 — 이티켓·바우처 PDF·사진 (docs/20 G2, 1개 10MB).
 * 기기에 저장돼 오프라인에서도 열린다. 여행 중이면 함께 쓰는 사람도 본다
 */
export function BookingDocs({
  trip,
  booking,
  canEdit,
  compact = false,
}: {
  /** 붙이기에만 필요 (보기만 할 때는 없어도 됨) */
  trip?: Trip | undefined;
  booking: Booking;
  canEdit: boolean;
  /** 일정 상세처럼 좁은 곳: 열기 버튼만 */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const docs = useLiveQuery(() => attachmentRepo.listByBooking(booking.id), [booking.id]) ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // 이름 바꾸는 중인 문서
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  if (compact && docs.length === 0) return null;
  return (
    <section aria-label={t('docs.title')} className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1 text-caption font-semibold text-fg-muted">
        <Paperclip aria-hidden="true" className="size-3.5" />
        {t('docs.title')}
      </h3>
      {docs.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {docs.map((d) => {
            const Icon = d.mime === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li key={d.id} className="flex items-center gap-1 pl-3">
                {editing?.id === d.id ? (
                  <form
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = editing.name;
                      setEditing(null);
                      void attachmentRepo.rename(d, name).then(() => toast(t('docs.renamed')));
                    }}
                  >
                    <input
                      aria-label={t('docs.nameLabel')}
                      value={editing.name}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => setEditing({ id: d.id, name: e.target.value })}
                      className="h-9 min-w-0 flex-1 rounded-btn bg-bg-subtle px-2 text-body-2"
                    />
                    <IconButton
                      label={t('common.cancel')}
                      icon={<X />}
                      tone="cancel"
                      onClick={() => setEditing(null)}
                    />
                    <IconButton
                      type="submit"
                      label={t('docs.renameSave')}
                      icon={<Check />}
                      tone="tint"
                      disabled={!editing.name.trim()}
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={!d.blob}
                    onClick={() => openDoc(d)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-body-2">{d.name}</span>
                    <span className="tabular shrink-0 text-micro text-fg-muted">
                      {d.blob ? mb(d.size) : t('docs.notDownloaded')}
                    </span>
                  </button>
                )}
                {canEdit && !compact && editing?.id !== d.id && (
                  <IconButton
                    label={t('docs.rename', { name: d.name })}
                    icon={<Pencil />}
                    onClick={() => setEditing({ id: d.id, name: d.name })}
                  />
                )}
                {canEdit && !compact && editing?.id !== d.id && (
                  <IconButton
                    label={t('docs.remove', { name: d.name })}
                    icon={<Trash2 />}
                    onClick={() =>
                      void confirmDelete(t('confirm.permanent', { name: d.name })).then(
                        (ok) =>
                          ok && void attachmentRepo.remove(d).then(() => toast(t('docs.removed'))),
                      )
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && !compact && trip && (
        <>
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            aria-label={t('docs.add')}
            className="sr-only"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (!file) return;
              setBusy(true);
              void attachmentRepo
                .add(trip, booking.id, file)
                .then((r) =>
                  toast(
                    r === 'too_large'
                      ? t('docs.tooLarge')
                      : r === 'bad_type'
                        ? t('docs.badType')
                        : r.full
                          ? t('docs.serverFull')
                          : t(r.remote ? 'docs.added' : 'docs.addedLocal'),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-card border border-dashed border-line text-caption font-semibold text-primary disabled:opacity-50"
          >
            <Paperclip aria-hidden="true" className="size-4" />
            {t('docs.add')}
          </button>
          <p className="text-micro text-fg-muted">{t('docs.hint')}</p>
        </>
      )}
    </section>
  );
}
