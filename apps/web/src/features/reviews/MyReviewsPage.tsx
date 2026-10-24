import type { ReviewView } from '@trippocket/shared';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { reviewsApi } from '../../data/api/reviews';
import { useAuth } from '../../data/authStore';
import { queuedReviews } from '../../data/reviewQueue';
import { useTranslation } from '../../i18n';
import { EmptyState, IconButton, toast, TopBar } from '../../shared/ui';
import { ServerOfflineNotice } from '../common/ServerOfflineNotice';
import { reviewDate } from './reviewDate';
import { Stars } from './StarRating';

/** 내 후기 모아 보기 (마이 → 여행 도구, 사용자 요청 2026-10-25) — 서버에서 받아 보여 줌, 지우면 포인트 회수 */
export function MyReviewsPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<ReviewView[] | null | 'offline'>(null);
  const waiting = queuedReviews().length;

  useEffect(() => {
    void reviewsApi.mine().then((r) => setList(r.ok ? r.data.reviews : 'offline'));
  }, []);

  async function remove(r: ReviewView) {
    const res = await reviewsApi.remove(r.id);
    if (!res.ok) return toast(t('review.failed'));
    setList((l) => (Array.isArray(l) ? l.filter((x) => x.id !== r.id) : l));
    const me = useAuth.getState().me;
    if (me) useAuth.setState({ me: { ...me, points: res.data.balance } });
    toast(t('review.deleted'));
  }

  return (
    <>
      <TopBar title={t('review.myTitle')} backTo="/me" />
      <div className="flex flex-col gap-3 px-5 pt-2 pb-6">
        {waiting > 0 && (
          <p role="status" className="rounded-card bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
            {t('review.waiting', { n: waiting })}
          </p>
        )}
        {list === 'offline' ? (
          <ServerOfflineNotice />
        ) : list && list.length === 0 ? (
          <EmptyState
            emoji="✍️"
            title={t('review.myEmpty')}
            description={t('review.myEmptyDesc')}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {(list ?? []).map((r) => (
              <li key={r.id} className="flex items-start gap-2 py-2.5 pr-1 pl-4">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body-2 font-semibold">{r.placeName}</span>
                    <span className="shrink-0 rounded-md bg-bg-subtle px-1.5 py-0.5 text-micro text-fg-sub">
                      {t(`kind.${r.kind}`)}
                    </span>
                  </span>
                  <span className="tabular flex items-center gap-1.5 text-caption text-fg-muted">
                    <Stars value={r.ratings.overall ?? 0} />
                    {reviewDate(r.createdAt)}
                    {!r.placeKey && ` · ${t('review.notLinked')}`}
                  </span>
                  {r.note && <span className="text-body-2 whitespace-pre-line">{r.note}</span>}
                </span>
                <IconButton
                  label={t('review.deleteOf', { name: r.placeName })}
                  icon={<Trash2 />}
                  onClick={() => void remove(r)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
