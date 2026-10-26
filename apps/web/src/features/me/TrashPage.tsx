import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTrash, useTrips } from '../../data/hooks';
import {
  trashRepo,
  TRASH_DAYS,
  type TrashEntry,
  type TrashKind,
} from '../../data/repositories/trashRepo';
import { useTranslation } from '../../i18n';
import { Button, EmptyState, toast, TopBar } from '../../shared/ui';

/** 화면 묶음 순서 */
const GROUPS: { key: 'trips' | 'inTrip' | 'saved' | 'templates'; kinds: TrashKind[] }[] = [
  { key: 'trips', kinds: ['trip'] },
  { key: 'inTrip', kinds: ['item', 'booking', 'checklist'] },
  { key: 'saved', kinds: ['saved'] },
  { key: 'templates', kinds: ['template'] },
];

/**
 * 마이 → 삭제 기록 복원 (사용자 요청 2026-10-27): 지운 지 7일 안의 여행(통째로)·일정·예약·준비물·
 * 저장 장소·템플릿을 되살린다. 함께 쓰는 여행은 소유자도 다른 멤버가 지운 것을 되살릴 수 있다
 */
export function TrashPage() {
  const { t } = useTranslation();
  const list = useTrash();
  const trips = new Map((useTrips() ?? []).map((tr) => [tr.id, tr.title]));
  // "N일 전" 기준 시각 — 화면을 연 때
  const [openedAt] = useState(() => Date.now());

  // 들어올 때 7일 넘은 기록은 기기에서 정리
  useEffect(() => {
    void trashRepo.purge();
  }, []);

  const ago = (iso: string) => {
    const days = Math.floor((openedAt - Date.parse(iso)) / 86_400_000);
    return days === 0 ? t('trash.today') : t('trash.daysAgo', { n: days });
  };

  async function restore(e: TrashEntry) {
    await trashRepo.restore(e);
    toast(t('trash.restored', { name: e.title }));
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('trash.title')} backTo="/me" />
      <div className="flex flex-col gap-5 px-5 pt-2">
        <p className="text-caption whitespace-pre-line text-fg-muted">
          {t('trash.desc', { n: TRASH_DAYS })}
        </p>
        {list && list.length === 0 && <EmptyState emoji="🗑️" title={t('trash.empty')} />}
        {GROUPS.map(({ key, kinds }) => {
          const rows = (list ?? []).filter((e) => kinds.includes(e.kind));
          if (rows.length === 0) return null;
          return (
            <section key={key} aria-label={t(`trash.group.${key}`)} className="flex flex-col gap-2">
              <h2 className="text-caption font-bold text-fg-muted">{t(`trash.group.${key}`)}</h2>
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                {rows.map((e) => (
                  <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-2 font-medium">{e.title}</span>
                      <span className="truncate text-caption text-fg-muted">
                        {[
                          t(`trash.kind.${e.kind}`),
                          e.tripId ? trips.get(e.tripId) : null,
                          ago(e.deletedAt),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={t('trash.restoreOf', { name: e.title })}
                      leading={<RotateCcw aria-hidden="true" className="size-4" />}
                      onClick={() => void restore(e)}
                    >
                      {t('trash.restore')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
