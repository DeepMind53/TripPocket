/**
 * 길찾기 · 지도 열기 딥링크 (docs/10 §5). 외부 API·비용 없이 사용자가 쓰는 지도 앱으로 넘긴다.
 * 출발지를 비워 두면 지도 앱이 "현재 위치"를 출발지로 쓴다 → 위치 권한이 필요 없다.
 */
export type MapApp = 'naver' | 'google' | 'kakao';
export type TravelMode = 'transit' | 'walk' | 'car';

export interface Destination {
  name: string;
  address?: string | undefined;
  coords?: { lat: number; lng: number } | undefined;
  googlePlaceId?: string | undefined;
}

export interface MapLink {
  /** 앱 전용 주소 (nmap://, kakaomap://). Google은 웹 주소가 앱도 연다 */
  app?: string;
  /** 앱이 없거나 PC일 때 여는 웹 주소 */
  web: string;
}

const enc = encodeURIComponent;

/** 검색어: 주소가 있으면 "이름 주소"가 가장 정확하다 */
function queryOf(dest: Destination): string {
  return dest.address ? `${dest.name} ${dest.address}` : dest.name;
}

const GOOGLE_MODE: Record<TravelMode, string> = {
  transit: 'transit',
  walk: 'walking',
  car: 'driving',
};
const NAVER_MODE: Record<TravelMode, string> = { transit: 'public', walk: 'walk', car: 'car' };
const KAKAO_MODE: Record<TravelMode, string> = {
  transit: 'PUBLICTRANSIT',
  walk: 'FOOT',
  car: 'CAR',
};

/**
 * 현재 위치 → 목적지 길찾기.
 * 좌표가 없으면 네이버·카카오는 길찾기 대신 장소 검색으로 연다 (앱에서 '길찾기'를 한 번 더 누름).
 */
export function directionsLink(
  app: MapApp,
  mode: TravelMode,
  dest: Destination,
  appName: string,
): MapLink {
  const c = dest.coords;
  switch (app) {
    case 'google': {
      // Google 장소 id가 있으면 이름으로(id가 정확한 장소를 고정), 없으면 길 정확도를 위해 좌표
      const target = dest.googlePlaceId || !c ? queryOf(dest) : `${c.lat},${c.lng}`;
      const placeId = dest.googlePlaceId ? `&destination_place_id=${enc(dest.googlePlaceId)}` : '';
      return {
        web: `https://www.google.com/maps/dir/?api=1&destination=${enc(target)}${placeId}&travelmode=${GOOGLE_MODE[mode]}`,
      };
    }
    case 'naver':
      return c
        ? {
            app: `nmap://route/${NAVER_MODE[mode]}?dlat=${c.lat}&dlng=${c.lng}&dname=${enc(dest.name)}&appname=${enc(appName)}`,
            web: `https://map.naver.com/p/search/${enc(queryOf(dest))}`,
          }
        : {
            app: `nmap://search?query=${enc(queryOf(dest))}&appname=${enc(appName)}`,
            web: `https://map.naver.com/p/search/${enc(queryOf(dest))}`,
          };
    case 'kakao':
      return c
        ? {
            app: `kakaomap://route?ep=${c.lat},${c.lng}&by=${KAKAO_MODE[mode]}`,
            web: `https://map.kakao.com/link/to/${enc(dest.name)},${c.lat},${c.lng}`,
          }
        : {
            app: `kakaomap://search?q=${enc(queryOf(dest))}`,
            web: `https://map.kakao.com/link/search/${enc(queryOf(dest))}`,
          };
  }
}

/** 지도에서 장소 보기 (길찾기 없이) */
export function placeLink(app: MapApp, dest: Destination, appName: string): MapLink {
  const q = queryOf(dest);
  switch (app) {
    case 'google': {
      // 이름(+주소)으로 찾게 해 Google 지도에 좌표 숫자 대신 장소 이름이 보이게 (사용자 요청 2026-10-27).
      // Google 장소 id가 있으면 그 장소로 바로, 이름이 없을 때만 좌표
      const target = dest.name.trim()
        ? q
        : dest.coords
          ? `${dest.coords.lat},${dest.coords.lng}`
          : q;
      const placeId = dest.googlePlaceId ? `&query_place_id=${enc(dest.googlePlaceId)}` : '';
      return { web: `https://www.google.com/maps/search/?api=1&query=${enc(target)}${placeId}` };
    }
    case 'naver':
      return {
        app: `nmap://search?query=${enc(q)}&appname=${enc(appName)}`,
        web: `https://map.naver.com/p/search/${enc(q)}`,
      };
    case 'kakao':
      return {
        app: `kakaomap://search?q=${enc(q)}`,
        web: `https://map.kakao.com/link/search/${enc(q)}`,
      };
  }
}

/** 국내(한국어 주소·한국 시간대)면 네이버를 먼저 (docs/05 S-30) */
export function preferredAppOrder(isDomestic: boolean): MapApp[] {
  return isDomestic ? ['naver', 'kakao', 'google'] : ['google', 'naver', 'kakao'];
}

/** 길찾기에 보여 줄 앱: 국내는 네이버·카카오, 해외는 구글만 (사용자 요청 2026-10-26) */
export function directionApps(isDomestic: boolean): MapApp[] {
  return isDomestic ? ['naver', 'kakao'] : ['google'];
}

/**
 * 링크 열기: 휴대폰이면 앱을 먼저 시도하고, 1.5초 안에 화면이 바뀌지 않으면(앱 없음) 웹으로.
 * PC·앱 주소가 없으면 바로 웹을 새 탭으로.
 */
export function openMapLink(link: MapLink): void {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (!link.app || !isTouch) {
    window.open(link.web, '_blank', 'noopener');
    return;
  }
  const fallback = window.setTimeout(() => {
    if (document.visibilityState === 'visible') window.location.href = link.web;
  }, 1500);
  const cancel = () => {
    if (document.visibilityState === 'hidden') window.clearTimeout(fallback);
  };
  document.addEventListener('visibilitychange', cancel, { once: true });
  window.location.href = link.app;
}
