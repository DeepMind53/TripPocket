import { inKorea } from '@trippocket/shared';
import { useSettings } from '../../data/settingsStore';
import { directionsLink, openMapLink, type Destination } from '../../shared/lib/directions';

/**
 * 길찾기 바로 열기 (누른 순간 열어야 팝업 차단을 피함). 열었으면 true — 호출한 곳은 false일 때만 시트를 띄운다.
 * - 해외(좌표가 한국 밖이거나 domestic=false)는 늘 Google 지도 (사용자 요청 2026-10-27)
 * - 국내는 설정에서 고른 네이버·카카오, "매번 묻기"면 시트
 */
export function openDirectionsDirect(dest: Destination, domestic?: boolean): boolean {
  const { directionsApp, travelMode } = useSettings.getState();
  const isDomestic = domestic ?? (dest.coords ? inKorea(dest.coords) : true);
  const app = isDomestic ? directionsApp : 'google';
  if (app === 'ask') return false;
  openMapLink(directionsLink(app, travelMode, dest, window.location.hostname));
  return true;
}
