import { useSettings } from '../../data/settingsStore';
import { directionsLink, openMapLink, type Destination } from '../../shared/lib/directions';

/**
 * 설정에서 기본 길찾기 앱을 골랐으면 시트 없이 바로 연다 (누른 순간 열어야 팝업 차단을 피함).
 * 열었으면 true — 호출한 곳은 false일 때만 시트를 띄운다.
 */
export function openDirectionsDirect(dest: Destination): boolean {
  const { directionsApp, travelMode } = useSettings.getState();
  if (directionsApp === 'ask') return false;
  openMapLink(directionsLink(directionsApp, travelMode, dest, window.location.hostname));
  return true;
}
