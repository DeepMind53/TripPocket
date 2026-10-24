import {
  maskedName,
  placeKeyOf,
  REVIEW_ASPECTS,
  REVIEW_NOTE_MAX,
  REVIEW_POINTS,
  type ItineraryItem,
  type ReviewAspect,
  type ReviewInput,
  type ReviewKind,
  type ReviewView,
} from '@trippocket/shared';
import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { reviewsApi } from '../../data/api/reviews';
import { useAuth } from '../../data/authStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { queuedFor, queueReview } from '../../data/reviewQueue';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, toast } from '../../shared/ui';
import { PlaceAutocomplete } from '../common/PlaceAutocomplete';
import { StarPicker } from './StarRating';

export interface ReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  item: ItineraryItem;
  kind: ReviewKind;
  domestic: boolean;
  near: { lat: number; lng: number } | undefined;
  existing: ReviewView | null;
  onSaved: () => void;
}

/**
 * 후기 쓰기 (docs/17 §2.2): 종류별 별점(종합 필수) + 기타.
 * 검색 없이 적은 일정은 구글·네이버에서 같은 장소를 찾아 연결하도록 안내 — 연결해야 공개·포인트 (사용자 결정 2026-10-25)
 */
export function ReviewSheet(props: ReviewSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('review.title', { name: props.item.title })}
    >
      {props.open && <ReviewForm key={props.item.id} {...props} />}
    </BottomSheet>
  );
}

function ReviewForm({
  tripId,
  item,
  kind,
  domestic,
  near,
  existing,
  onOpenChange,
  onSaved,
}: ReviewSheetProps) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const draft = queuedFor(item.id);
  const [ratings, setRatings] = useState<Partial<Record<ReviewAspect, number>>>(
    draft?.ratings ?? existing?.ratings ?? {},
  );
  const [note, setNote] = useState(draft?.note ?? existing?.note ?? '');
  const [place, setPlace] = useState(item.place);
  const [search, setSearch] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const placeKey = placeKeyOf(place);
  const aspects = REVIEW_ASPECTS[kind] as readonly ReviewAspect[];
  const shownName = me ? (me.hideNickname ? maskedName(me.publicNo ?? 0) : me.nickname) : '';
  // 이미 이 장소로 포인트를 받았으면(고치기) 버튼에 포인트를 적지 않는다
  const earns = !!placeKey && !(existing?.placeKey && existing.placeKey === placeKey);

  async function submit() {
    if (!ratings.overall) return toast(t('review.needOverall'));
    const input: ReviewInput = {
      tripId,
      itemId: item.id,
      kind,
      placeKey,
      placeName: place?.name ?? item.title,
      ratings: ratings as Record<string, number>,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setBusy(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        queueReview(input);
        toast(t('review.queued'));
        return onOpenChange(false);
      }
      // 일정(장소 연결 포함)이 서버에 있어야 받는다 → 먼저 동기화
      await (await import('../../data/sync/syncEngine')).syncNow();
      const res = await reviewsApi.save(input);
      if (res.ok) {
        const cur = useAuth.getState().me;
        if (cur) useAuth.setState({ me: { ...cur, points: res.data.balance } });
        toast(
          res.data.pointsAwarded
            ? t('review.savedPoints', { n: res.data.pointsAwarded })
            : t('review.saved'),
        );
        onSaved();
        return onOpenChange(false);
      }
      if (res.reason === 'offline' || res.status === 409) {
        queueReview(input);
        toast(t('review.queued'));
        return onOpenChange(false);
      }
      toast(
        t(
          res.status === 422
            ? 'review.notVisited'
            : res.status === 403
              ? 'review.viewerOnly'
              : 'review.failed',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex flex-col gap-1">
        {aspects.map((a) => (
          <StarPicker
            key={a}
            label={t(`review.aspect.${a}`)}
            required={a === 'overall'}
            value={ratings[a]}
            onChange={(v) =>
              setRatings((r) => {
                const next = { ...r };
                if (v) next[a] = v;
                else delete next[a];
                return next;
              })
            }
          />
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-body-2 font-medium">{t('review.note')}</span>
        <textarea
          value={note}
          maxLength={REVIEW_NOTE_MAX}
          rows={3}
          placeholder={t('review.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-btn border border-line bg-bg-subtle px-3 py-2 text-body-2 outline-none focus:border-primary"
        />
      </label>

      {/* 장소 연결: 연결해야 다른 사람도 보고 포인트를 받는다 */}
      <section
        aria-label={t('review.link.title')}
        className="flex flex-col gap-2 rounded-card border border-dashed border-primary/60 p-3"
      >
        {placeKey ? (
          <p className="flex items-center gap-1.5 text-caption text-fg-sub">
            <Link2 aria-hidden="true" className="size-4 text-primary" />
            {t('review.link.linked', { name: place?.name ?? item.title })}
          </p>
        ) : (
          <>
            <p className="text-caption whitespace-pre-line text-fg-sub">
              {t('review.link.desc', { n: REVIEW_POINTS })}
            </p>
            <input
              aria-label={t('review.link.search')}
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-btn border border-line bg-bg-subtle px-3 text-body-2 outline-none focus:border-primary"
            />
            <PlaceAutocomplete
              query={search}
              domestic={domestic}
              near={near}
              onPick={(p) => {
                const next = {
                  name: p.name,
                  ...(p.address ? { address: p.address } : {}),
                  ...(p.coords ? { coords: p.coords, coordsSource: p.source } : {}),
                  ...(p.source === 'google'
                    ? { googlePlaceId: p.id, coordsFetchedAt: new Date().toISOString() }
                    : {}),
                  ...(p.url && p.source !== 'google' ? { externalUrl: p.url } : {}),
                };
                setPlace(next);
                // 일정에도 장소를 붙인다 (지도·길찾기에도 쓰이게)
                void itemRepo.update(item.id, { place: next });
              }}
            />
            <p className="text-micro text-fg-muted">{t('review.link.skip')}</p>
          </>
        )}
      </section>

      <p className="text-caption text-fg-muted">
        {placeKey ? t('review.publicAs', { name: shownName }) : t('review.membersOnly')}
      </p>
      <Button size="lg" fullWidth loading={busy} onClick={() => void submit()}>
        {earns ? t('review.submitPoints', { n: REVIEW_POINTS }) : t('review.submit')}
      </Button>
    </div>
  );
}
