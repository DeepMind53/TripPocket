import type { ChecklistItem } from '@trippocket/shared';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../i18n';

/**
 * 일행이 공유한 준비물 (사용자 요청 2026-10-27) — 보기 전용, [담기]는 내 준비물 초안에 넣는다 ([저장]해야 반영).
 * 이미 내 목록에 있는 것(같은 글)은 담기 버튼 대신 표시
 */
export function SharedPacking({
  items,
  have,
  onAdd,
}: {
  items: readonly ChecklistItem[];
  have: readonly string[];
  onAdd: (item: ChecklistItem) => void;
}) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const owned = new Set(have.map(norm));
  return (
    <section
      aria-label={t('checklist.share.fromOthers')}
      className="flex flex-col gap-2 rounded-card bg-bg-subtle px-3 py-2.5"
    >
      <h2 className="text-caption font-bold text-fg-sub">👥 {t('checklist.share.fromOthers')}</h2>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex min-h-10 items-center gap-2 text-body-2">
            <span className="min-w-0 flex-1 truncate">
              {i.text}
              {i.category && <span className="text-caption text-fg-muted"> · {i.category}</span>}
            </span>
            {owned.has(norm(i.text)) ? (
              <span className="shrink-0 text-caption text-fg-muted">
                {t('checklist.share.have')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onAdd(i)}
                aria-label={t('checklist.share.addOf', { name: i.text })}
                className="flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 text-caption"
              >
                <Plus aria-hidden="true" className="size-3.5 text-primary" />
                {t('checklist.share.add')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
