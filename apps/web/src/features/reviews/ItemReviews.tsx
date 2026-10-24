import type { ReviewAspect, ReviewKind } from '@trippocket/shared';
import { REVIEW_ASPECTS } from '@trippocket/shared';
import { useState } from 'react';
import type { ItemReviews as Data } from '../../data/api/reviews';
import { useTranslation } from '../../i18n';
import { reviewDate } from './reviewDate';
import { Stars } from './StarRating';
import { OfflineNote } from '../common/OfflineNote';

/**
 * 일정 상세 아래 후기 (docs/17 §2.1): 평균·항목별 평균 + 최근 3개, [후기 더 보기]로 전부.
 * 보이는 이름 = 닉네임 또는 User#N, 등록 날짜
 */
export function ItemReviews({ data, kind }: { data: Data | null; kind: ReviewKind }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  if (!data)
    return typeof navigator !== 'undefined' && navigator.onLine === false ? (
      <OfflineNote text={t('review.offline')} />
    ) : null;
  const { reviews, summary } = data;
  const avg = summary.averages;
  const aspects = (REVIEW_ASPECTS[kind] as readonly ReviewAspect[]).filter(
    (a) => a !== 'overall' && avg[a] !== undefined,
  );
  const shown = all ? reviews : reviews.slice(0, 3);

  return (
    <section aria-label={t('review.sectionTitle')} className="flex flex-col gap-2">
      <h3 className="text-caption font-bold text-fg-muted">{t('review.sectionTitle')}</h3>
      {reviews.length === 0 ? (
        <p className="text-caption text-fg-muted">{t('review.none')}</p>
      ) : (
        <>
          <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-fg-sub">
            <span className="flex items-center gap-1 text-body-2 font-bold text-fg">
              <Stars value={avg.overall ?? 0} />
              {avg.overall?.toFixed(1)}
              <span className="font-normal text-fg-muted">({summary.count})</span>
            </span>
            {aspects.map((a) => (
              <span key={a}>
                {t(`review.aspect.${a}`)} {avg[a]!.toFixed(1)}
              </span>
            ))}
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="tabular flex items-center gap-1.5 text-caption text-fg-muted">
                  <span className="font-semibold text-fg-sub">
                    {r.mine ? t('review.me') : r.author}
                  </span>
                  · {reviewDate(r.createdAt)}
                  <Stars value={r.ratings.overall ?? 0} className="ml-auto" />
                </span>
                {r.note && <p className="text-body-2 whitespace-pre-line">{r.note}</p>}
              </li>
            ))}
          </ul>
          {!all && reviews.length > 3 && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="self-start text-caption font-semibold text-primary"
            >
              {t('review.more', { n: reviews.length - 3 })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
