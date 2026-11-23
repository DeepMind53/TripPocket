import { dayNumberOf, SAVED_PLACES_MAX, type ItineraryItem, type Trip } from '@trippocket/shared';
import { BookmarkPlus, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router';
import { applyVisit, saveSkippedPlace } from '../../data/skippedToSaved';
import { isDomesticTrip } from '../../domain/tripPlace';
import { visitCity } from '../../domain/visitLog';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet, Button, toast } from '../../shared/ui';
import { DirectionsPanel } from '../common/DirectionsPanel';
import { VisitToggle } from '../common/VisitToggle';
import { ItemPhotos } from '../photos/ItemPhotos';

/**
 * 방문 기록 상세 (docs/32 §5): 방문·미방문 바꾸기, 일정에서 보기, 저장 탭에 담기, 사진, 길찾기.
 * 미방문은 일정 화면과 같이 저장 탭에도 담긴다 (applyVisit)
 */
export function VisitItemSheet({
  item,
  trip,
  open,
  onOpenChange,
}: {
  item: ItineraryItem | undefined;
  trip: Trip | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toastResult = (r: Awaited<ReturnType<typeof applyVisit>>, skipped: boolean) => {
    if (r === 'saved') toast(t(skipped ? 'visit.savedToSaved' : 'visit.savedDone'));
    else if (r === 'exists' && !skipped) toast(t('visit.savedExists'));
    else if (r === 'limit') toast(t('saved.limit', { max: SAVED_PLACES_MAX }));
  };
  const day = item?.date && trip ? dayNumberOf(trip.startDate, trip.endDate, item.date) : null;
  const sub = [item?.date ? formatMonthDay(item.date) : null, trip?.title]
    .filter(Boolean)
    .join(' · ');
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item?.title ?? ''}
      {...(sub ? { description: sub } : {})}
    >
      {item && (
        <div className="flex flex-col gap-4 pb-2">
          <VisitToggle
            value={item.visit}
            label={item.title}
            onChange={(v) => {
              if (!trip) return;
              void applyVisit(item, v, trip).then((r) => toastResult(r, true));
            }}
          />
          <div className="flex gap-2">
            {trip && (
              <Button
                variant="secondary"
                size="sm"
                leading={<CalendarDays aria-hidden="true" className="size-4" />}
                onClick={() =>
                  void navigate(`/trips/${trip.id}/plan?day=${day ?? 'wish'}`, { replace: true })
                }
              >
                {t('visit.openPlan')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              leading={<BookmarkPlus aria-hidden="true" className="size-4" />}
              onClick={() => {
                const city = visitCity(item, trip);
                void saveSkippedPlace(item, {
                  countryCode: city?.countryCode ?? trip?.destinations[0]?.countryCode,
                  cityTag: city?.name ?? trip?.destinations[0]?.name,
                }).then((r) => toastResult(r, false));
              }}
            >
              {t('visit.saveToSaved')}
            </Button>
          </div>
          <ItemPhotos item={item} />
          {item.kind !== 'note' && (
            <section aria-label={t('detail.directions')} className="flex flex-col gap-2">
              <h3 className="text-body-2 font-semibold">{t('detail.directions')}</h3>
              <DirectionsPanel
                destination={{
                  name: item.place?.name ?? item.title,
                  address: item.place?.address,
                  coords: item.place?.coords,
                  googlePlaceId: item.place?.googlePlaceId,
                }}
                isDomestic={trip ? isDomesticTrip(trip) : false}
              />
            </section>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
