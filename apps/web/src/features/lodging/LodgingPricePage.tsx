import { useSearchParams } from 'react-router';
import { useTrip, useTripBookings } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { TopBar } from '../../shared/ui';
import { LodgingPricePanel } from './LodgingPricePanel';
import { lodgingPriceInitial } from './lodgingPriceInitial';

/**
 * 숙소 최저가 화면 (실험실, docs/28): 예약 탭 숙소 카드(?booking=)·빠른 메뉴 바로가기(?trip=)에서 연다.
 * 숙소 예약이면 이름·날짜·인원·아고다 링크를, 여행이면 여행 날짜를 채운다
 */
export function LodgingPricePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const tripId = params.get('trip') ?? '';
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId);
  const bookingId = params.get('booking');
  const booking = bookingId ? bookings?.find((b) => b.id === bookingId) : undefined;
  // 여행·예약을 다 읽은 뒤에 칸을 채운다 (처음 한 번만 쓰는 값이라)
  const ready = !tripId || (trip !== undefined && (!bookingId || bookings !== undefined));
  return (
    <>
      <TopBar
        title={t('lodgingPrice.title')}
        backTo={tripId ? `/trips/${tripId}/${bookingId ? 'bookings' : 'plan'}` : '/'}
      />
      <div className="px-5 pt-2 pb-8">
        {ready && (
          <LodgingPricePanel
            initial={lodgingPriceInitial(booking?.kind === 'lodging' ? booking : undefined, trip)}
          />
        )}
      </div>
    </>
  );
}
