/**
 * 여행지 기상·재난 특보 (docs/24, ADR-0008). 서버 GET /api/alerts 응답 형식 + 나라별 공식 특보 링크.
 * 서버는 공식 출처 내용을 옮기기만 한다 — 자체 판단 문구를 만들지 않는다 (일본 기상업무법, docs/24 §5)
 */

/** 종류: 열대저기압(태풍)·지진·홍수·화산·산불·가뭄·외교부 여행경보·나라 기상청 특보(weather) */
export type AlertKind =
  'cyclone' | 'earthquake' | 'flood' | 'volcano' | 'wildfire' | 'drought' | 'travel' | 'weather';

/** red = GDACS 빨강·외교부 3~4단계·특별여행주의보·경보 / orange = GDACS 주황·외교부 2단계·규모 6 이상 지진 / info = 그 밖 */
export type AlertLevel = 'red' | 'orange' | 'info';

/** 전 세계: gdacs·usgs·mofa / 나라 기상청 (docs/24 §7): jma 일본·kma 한국·nws 미국(괌·사이판)·cwa 대만 */
export type AlertSource = 'gdacs' | 'usgs' | 'mofa' | 'jma' | 'kma' | 'nws' | 'cwa';

/** 목적지 좌표가 있어야 지역을 고를 수 있는 나라 (일본 기상청·미국 기상청). 그 밖은 나라 전체 특보 */
export const POINT_ALERT_COUNTRIES: readonly string[] = ['JP', 'US'];

/** 목적지 도시 좌표를 약 10km로 줄인다 (지역 고르기에만, 서버에 남기지 않음) */
export const roundAlertPoint = (n: number) => Math.round(n * 10) / 10;

export interface DestinationAlert {
  /** 출처 안에서 겹치지 않는 값 (같은 사건을 다시 알리지 않으려고) */
  id: string;
  country: string;
  kind: AlertKind;
  level: AlertLevel;
  /** 원문 이름 (예: "Tropical Cyclone ARNAB-26", "M 6.1 - 45 km E of Hualien City, Taiwan") */
  title: string;
  /** 외교부 여행경보 단계 1~4 */
  step?: number | undefined;
  /** 외교부 특별여행주의보(evacuate)·특별여행경보(forbidden) 지역 — API 필드 이름을 따름 */
  special?: 'evacuate' | 'forbidden' | undefined;
  /** 외교부: 해당 지역 설명 원문 */
  area?: string | undefined;
  /** 외교부: 나라 전체인가 */
  whole?: boolean | undefined;
  /** 나라 기상청 특보 종류 (원문 이름, 예: "강풍주의보", "大雨警報", "Flood Warning") */
  names?: string[] | undefined;
  /** 지진 규모 */
  magnitude?: number | undefined;
  /** ISO 시각 */
  from?: string | undefined;
  until?: string | undefined;
  source: AlertSource;
  url: string;
}

export interface AlertsResponse {
  alerts: DestinationAlert[];
  /** 서버가 출처에서 마지막으로 받은 시각 (ISO) */
  checkedAt: string;
  /** 지금 못 받은 출처 (키 없음·한도·장애) — 화면에 "일부 정보를 못 받았어요" */
  missing: AlertSource[];
}

/** 나라 기상청 특보 페이지 — 2026-10-27 접속 확인. 없으면 WMO 세계 악기상 정보 센터 */
export const WEATHER_WARNING_LINKS: Readonly<Record<string, { name: string; url: string }>> = {
  KR: { name: '기상청 특보', url: 'https://www.weather.go.kr/w/weather/warning/status.do' },
  JP: { name: '일본 기상청 경보·주의보', url: 'https://www.jma.go.jp/bosai/warning/' },
  TW: { name: '대만 중앙기상서', url: 'https://www.cwa.gov.tw/V8/E/' },
  CN: { name: '중국 중앙기상대 경보', url: 'http://www.nmc.cn/publish/alarm.html' },
  HK: {
    name: '홍콩 천문대 경보',
    url: 'https://www.hko.gov.hk/en/wxinfo/dailywx/wxwarntoday.htm',
  },
  MO: { name: '마카오 기상국', url: 'https://www.smg.gov.mo/en' },
  VN: { name: '베트남 국립수문기상예보센터', url: 'https://nchmf.gov.vn/' },
  TH: { name: '태국 기상청', url: 'https://www.tmd.go.th/en' },
  PH: { name: '필리핀 기상청(PAGASA)', url: 'https://www.pagasa.dost.gov.ph/' },
  SG: { name: '싱가포르 기상청', url: 'https://www.weather.gov.sg/home/' },
  MY: { name: '말레이시아 기상청', url: 'https://www.met.gov.my/' },
  ID: {
    name: '인도네시아 기상청(BMKG) 경보',
    url: 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca',
  },
  MN: { name: '몽골 기상청', url: 'https://www.weather.gov.mn/' },
  US: { name: '미국 기상청 경보', url: 'https://www.weather.gov/alerts' },
  GU: { name: '미국 기상청 괌', url: 'https://www.weather.gov/gum/' },
  MP: { name: '미국 기상청 괌·사이판', url: 'https://www.weather.gov/gum/' },
  CA: { name: '캐나다 기상청 경보', url: 'https://weather.gc.ca/?layers=alert' },
  AU: { name: '호주 기상청 경보', url: 'http://www.bom.gov.au/australia/warnings/' },
  NZ: { name: '뉴질랜드 MetService 경보', url: 'https://www.metservice.com/warnings/home' },
  GB: {
    name: '영국 기상청 경보',
    url: 'https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings',
  },
  FR: { name: 'MeteoAlarm (유럽 기상 경보)', url: 'https://meteoalarm.org/' },
  IT: { name: 'MeteoAlarm (유럽 기상 경보)', url: 'https://meteoalarm.org/' },
  ES: { name: 'MeteoAlarm (유럽 기상 경보)', url: 'https://meteoalarm.org/' },
  CH: { name: 'MeteoAlarm (유럽 기상 경보)', url: 'https://meteoalarm.org/' },
};

export const WMO_SEVERE_WEATHER = {
  name: 'WMO 세계 악기상 정보 센터',
  url: 'https://severeweather.wmo.int/',
};

/** 이 나라 기상청 특보 링크 (모르는 나라는 WMO) */
export const warningLinkFor = (country: string) =>
  WEATHER_WARNING_LINKS[country] ?? WMO_SEVERE_WEATHER;

/** 외교부 해외안전여행 나라 정보 */
export const MOFA_SAFETY_URL = 'https://www.0404.go.kr/';
