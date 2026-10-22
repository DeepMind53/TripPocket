import { directionsLink, placeLink, preferredAppOrder } from './directions';

const ichiran = { name: '이치란 라멘', address: '신주쿠 3-34-11' };
const withCoords = { name: '센소지', coords: { lat: 35.7148, lng: 139.7967 } };

describe('길찾기 링크', () => {
  it('Google: 좌표가 없으면 이름+주소, 이동수단 매핑', () => {
    const { web, app } = directionsLink('google', 'walk', ichiran, 'trippocket.app');
    expect(app).toBeUndefined();
    expect(web).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=%EC%9D%B4%EC%B9%98%EB%9E%80%20%EB%9D%BC%EB%A9%98%20%EC%8B%A0%EC%A3%BC%EC%BF%A0%203-34-11&travelmode=walking',
    );
  });

  it('Google: 좌표와 place_id가 있으면 함께 보낸다', () => {
    const { web } = directionsLink(
      'google',
      'transit',
      { ...withCoords, googlePlaceId: 'abc' },
      'x',
    );
    expect(web).toContain('destination=35.7148%2C139.7967');
    expect(web).toContain('destination_place_id=abc');
    expect(web).toContain('travelmode=transit');
  });

  it('네이버: 좌표가 있으면 길찾기, 없으면 장소 검색', () => {
    expect(directionsLink('naver', 'car', withCoords, 'trippocket.app').app).toBe(
      'nmap://route/car?dlat=35.7148&dlng=139.7967&dname=%EC%84%BC%EC%86%8C%EC%A7%80&appname=trippocket.app',
    );
    const noCoords = directionsLink('naver', 'transit', ichiran, 'trippocket.app');
    expect(noCoords.app).toMatch(/^nmap:\/\/search\?query=/);
    expect(noCoords.web).toMatch(/^https:\/\/map\.naver\.com\/p\/search\//);
  });

  it('카카오: 이동수단 코드', () => {
    expect(directionsLink('kakao', 'transit', withCoords, 'x').app).toBe(
      'kakaomap://route?ep=35.7148,139.7967&by=PUBLICTRANSIT',
    );
    expect(directionsLink('kakao', 'walk', withCoords, 'x').app).toContain('by=FOOT');
  });

  it('지도에서 보기', () => {
    expect(placeLink('google', ichiran, 'x').web).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
    expect(placeLink('kakao', ichiran, 'x').app).toMatch(/^kakaomap:\/\/search\?q=/);
  });

  it('국내면 네이버, 해외면 구글을 먼저', () => {
    expect(preferredAppOrder(true)[0]).toBe('naver');
    expect(preferredAppOrder(false)[0]).toBe('google');
  });
});
