import { isOutsideHours, weekday, type LocalDate, type PlaceDetails } from '@trippocket/shared';
import { attachFallback } from '../../data/limitNotice';
import { placeDetailLinks } from '../../shared/lib/fallbackLinks';
import { FallbackLinks } from '../common/FallbackLinks';
import { Clock, Star, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { placesApi } from '../../data/api/places';
import { useTranslation } from '../../i18n';
import { Button } from '../../shared/ui';

/**
 * 고른 Google 장소의 평점·영업시간 (docs/10 §4.4): 누를 때만 조회(무료 사용량 절약), 저장하지 않음.
 * 일정 시간이 영업시간 밖이면 경고
 */
export function PlaceHours({
  googlePlaceId,
  date,
  time,
  name,
}: {
  /** 한도일 때 Google 지도에서 직접 볼 이름 */
  name?: string | undefined;
  googlePlaceId: string;
  date: LocalDate | null;
  time: string;
}) {
  const { t } = useTranslation();
  const [d, setD] = useState<PlaceDetails | null | 'error'>(null);
  const [busy, setBusy] = useState(false);

  if (!d)
    return (
      <Button
        size="sm"
        variant="ghost"
        loading={busy}
        className="self-start"
        onClick={() => {
          setBusy(true);
          void placesApi
            .googleDetails(googlePlaceId)
            .then((r) => {
              setD(r.ok ? r.data : 'error');
              if (!r.ok && r.reason === 'limit')
                attachFallback(placeDetailLinks(name ?? '', googlePlaceId));
            })
            .finally(() => setBusy(false));
        }}
      >
        <Clock aria-hidden="true" className="size-4" />
        {t('placeSearch.showHours')}
      </Button>
    );
  if (d === 'error')
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-caption text-fg-muted">{t('placeSearch.hoursError')}</p>
        <FallbackLinks links={placeDetailLinks(name ?? '', googlePlaceId)} />
      </div>
    );

  const wd = date ? weekday(date) : new Date().getDay();
  // Google 요일 문장은 월요일부터 → 일요일(0)은 마지막
  const todayText = d.weekdayText?.[(wd + 6) % 7];
  const outside = time ? isOutsideHours(d.periods, wd, time) : null;
  return (
    <div className="flex flex-col gap-1 rounded-btn bg-bg-subtle px-3 py-2 text-caption">
      {d.rating !== undefined && (
        <span className="flex items-center gap-1 font-semibold">
          <Star aria-hidden="true" className="size-3.5 fill-rating text-rating" />
          {d.rating.toFixed(1)}
          <span className="font-normal text-fg-muted">
            ({new Intl.NumberFormat('ko').format(d.userRatingCount ?? 0)})
          </span>
        </span>
      )}
      {todayText && <span className="text-fg-sub">{todayText}</span>}
      {outside && (
        <span role="alert" className="flex items-center gap-1 font-semibold text-warning">
          <TriangleAlert aria-hidden="true" className="size-3.5" />
          {t('placeSearch.outsideHours', { time })}
        </span>
      )}
      <span className="text-[11px] text-fg-muted">{t('placeSearch.fromGoogle')}</span>
    </div>
  );
}
