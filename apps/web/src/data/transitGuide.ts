/**
 * 나라별 대중교통 안내 (실험실 "대중교통 안내", 사용자 요청 2026-11-03):
 * 교통수단(지하철·버스·기차·트램·자전거·택시)·대표 도시 기본요금·환승·추천 앱·공식 링크.
 * 요금은 여행객이 많이 가는 도시 1~2곳의 대표값 — 여러 안내가 일치한 값이며 공식 운임표로 다시 확인할 것
 * (월간 갱신 docs/22 A10, TRANSIT_GUIDE_CHECKED_AT)
 */
export type TransitModeKind =
  'metro' | 'bus' | 'coach' | 'rail' | 'tram' | 'ferry' | 'bike' | 'taxi';

export interface TransitMode {
  kind: TransitModeKind;
  /** 이름 (도시를 앞에) */
  name: string;
  /** 대표 요금 (없으면 생략) */
  fare?: string;
}

export interface CountryTransit {
  modes: readonly TransitMode[];
  /** 환승 할인·규칙 */
  transfer: string;
  /** 추천 앱 */
  apps: readonly string[];
  /** 공식 안내 (교통 운영 기관) */
  url: string;
  /** 요금이 곧 바뀌는 등 주의 */
  note?: string;
}

export const TRANSIT_GUIDE_CHECKED_AT = '2026-11-03';

export const TRANSIT_GUIDE: Record<string, CountryTransit> = {
  KR: {
    modes: [
      { kind: 'metro', name: '서울 지하철', fare: '교통카드 1,550원~' },
      { kind: 'bus', name: '서울 시내버스', fare: '교통카드 1,500원' },
      { kind: 'rail', name: 'KTX·SRT·ITX·무궁화호' },
      { kind: 'coach', name: '고속·시외버스' },
      { kind: 'bike', name: '서울 따릉이' },
      { kind: 'taxi', name: '택시 (카카오 T)' },
    ],
    transfer:
      '수도권은 버스·지하철을 30분 안에 갈아타면\n거리만큼만 내요 (밤 9시~아침 7시는 1시간)',
    apps: ['카카오맵', '네이버 지도', '코레일톡', '카카오 T'],
    url: 'https://news.seoul.go.kr/traffic/traffic_price',
  },
  JP: {
    modes: [
      { kind: 'metro', name: '도쿄 메트로·도에이 지하철', fare: 'IC 178엔~' },
      { kind: 'metro', name: '오사카 메트로', fare: '190엔~' },
      { kind: 'bus', name: '오사카 시내버스', fare: '210엔 균일' },
      { kind: 'rail', name: 'JR·사철·신칸센' },
      { kind: 'tram', name: '노면전차 (도덴·한카이 등)' },
      { kind: 'bike', name: '도코모 바이크셰어·HELLO CYCLING' },
      { kind: 'taxi', name: '택시 (GO 앱)' },
    ],
    transfer: '회사가 다르면 요금을 따로 내요\n도쿄 메트로↔도에이는 합친 요금에서 70엔 할인',
    apps: ['Google 지도', '乗換案内 (Japan Transit)', 'NAVITIME', 'GO (택시)'],
    url: 'https://www.tokyometro.jp/kr/',
    note: '2026-03부터 도쿄 지하철 개찰구에서\n해외 컨택리스 카드도 돼요',
  },
  TW: {
    modes: [
      { kind: 'metro', name: '타이베이 MRT', fare: 'NT$20~65' },
      { kind: 'bus', name: '타이베이 시내버스', fare: '구간당 NT$15' },
      { kind: 'rail', name: '대만 고속철(HSR)·대만철도(TRA)' },
      { kind: 'coach', name: '고속버스 (국광객운 등)' },
      { kind: 'bike', name: 'YouBike 2.0 (여권·이메일로 가입)' },
      { kind: 'taxi', name: '택시·Uber' },
    ],
    transfer: 'MRT↔버스를 1시간 안에 같은 이지카드로 타면\n성인 약 NT$8 할인',
    apps: ['Google 지도', '台北捷運Go', 'Bus+', 'YouBike 2.0'],
    url: 'https://www.metro.taipei',
  },
  HK: {
    modes: [
      { kind: 'metro', name: 'MTR', fare: '옥토퍼스 HK$4~' },
      { kind: 'tram', name: '트램 (딩딩)', fare: 'HK$3.3 균일' },
      { kind: 'ferry', name: '스타페리', fare: 'HK$4~5대' },
      { kind: 'bus', name: '시티버스·KMB' },
      { kind: 'taxi', name: '택시·Uber' },
    ],
    transfer: 'MTR 노선끼리는 한 번 요금이에요\n버스·미니버스 일부는 갈아타면 할인',
    apps: ['Google 지도', 'MTR Mobile', 'Citymapper', 'HKeMobility'],
    url: 'https://www.mtr.com.hk',
    note: '스타페리 요금이 2027-01-25에 올라요',
  },
  MO: {
    modes: [
      { kind: 'bus', name: '시내버스', fare: '현금 MOP6 · 마카오패스 MOP3' },
      { kind: 'metro', name: '마카오 LRT', fare: 'MOP6~12 (카드 절반)' },
      { kind: 'bus', name: '카지노·호텔 무료 셔틀' },
      { kind: 'taxi', name: '택시' },
    ],
    transfer: '버스는 거스름돈이 없어요\n마카오패스를 쓰면 버스·LRT가 싸요',
    apps: ['Google 지도', 'Macau Bus (DSAT)'],
    url: 'https://www.dsat.gov.mo',
  },
  CN: {
    modes: [
      { kind: 'metro', name: '상하이·베이징 지하철', fare: '3~9위안 (거리)' },
      { kind: 'bus', name: '시내버스', fare: '1~2위안대' },
      { kind: 'rail', name: '고속철도 (여권으로 탑승)' },
      { kind: 'bike', name: '공유자전거 (알리페이로)' },
      { kind: 'taxi', name: '디디 (알리페이 안에서)' },
    ],
    transfer: '지하철 노선끼리는 역 밖으로 안 나가면\n한 번 요금이에요',
    apps: ['알리페이 (교통 QR)', '고덕지도 (Amap)', 'Metro大都会 (상하이)'],
    url: 'https://www.shmetro.com',
  },
  TH: {
    modes: [
      { kind: 'metro', name: '방콕 BTS', fare: '17~65밧' },
      { kind: 'metro', name: '방콕 MRT', fare: '17~44밧' },
      { kind: 'rail', name: '공항철도(ARL)·태국 철도' },
      { kind: 'bus', name: '시내버스·송태우' },
      { kind: 'ferry', name: '짜오프라야 수상버스' },
      { kind: 'taxi', name: '택시·Grab·Bolt' },
    ],
    transfer: 'BTS·MRT는 회사가 달라 요금을 따로 내요\nBTS는 래빗카드·토큰, MRT는 해외 카드 찍기',
    apps: ['Google 지도', 'ViaBus', 'Grab', 'Bolt'],
    url: 'https://www.bts.co.th',
    note: '20밧 균일 요금은 2026-06에 끝났어요\n2027 공동 요금 계획은 아직 확정 전',
  },
  VN: {
    modes: [
      { kind: 'metro', name: '하노이 메트로', fare: '약 8,000~19,000동' },
      { kind: 'metro', name: '호찌민 메트로 1호선', fare: '약 7,000~20,000동' },
      { kind: 'bus', name: '시내버스' },
      { kind: 'rail', name: '베트남 철도·슬리핑버스' },
      { kind: 'taxi', name: 'Grab·Xanh SM (전기 택시)' },
    ],
    transfer: '환승 할인은 거의 없어요\n짧은 거리는 그랩 오토바이가 편해요',
    apps: ['Google 지도', 'Grab', 'Xanh SM', 'Be'],
    url: 'https://hanoimetro.net.vn',
  },
  SG: {
    modes: [
      { kind: 'metro', name: 'MRT·LRT', fare: '카드 S$1.28~ (거리)' },
      { kind: 'bus', name: '시내버스', fare: 'MRT와 같은 거리 요금' },
      { kind: 'bike', name: '공유자전거 (Anywheel 등)' },
      { kind: 'taxi', name: '택시·Grab' },
    ],
    transfer:
      '버스·MRT를 45분 안에 같은 카드로 갈아타면\n이어진 거리로 계산해요 · 현금은 더 비싸요',
    apps: ['Google 지도', 'MyTransport.SG', 'SimplyGo', 'Grab'],
    url: 'https://www.lta.gov.sg',
  },
  MY: {
    modes: [
      { kind: 'metro', name: '쿠알라룸푸르 LRT·MRT·모노레일', fare: '터치앤고 RM1.20~' },
      { kind: 'bus', name: 'Go KL 버스', fare: 'RM1 (터치앤고만)' },
      { kind: 'bus', name: 'RapidKL 버스', fare: 'RM1~' },
      { kind: 'rail', name: 'KLIA 익스프레스·KTM·ETS' },
      { kind: 'taxi', name: 'Grab' },
    ],
    transfer: 'RapidKL 노선끼리는 이어서 탈 수 있어요\n3일 무제한 MyRapid 패스(RM30)도 있어요',
    apps: ['Google 지도', 'MyRapid PULSE', 'Grab', 'Touch ’n Go eWallet'],
    url: 'https://myrapid.com.my',
    note: 'Go KL 버스는 2026년부터 유료예요',
  },
  ID: {
    modes: [
      { kind: 'bus', name: '트랜스자카르타', fare: 'Rp3,500 균일' },
      { kind: 'rail', name: 'KRL 통근열차', fare: 'Rp3,000~' },
      { kind: 'metro', name: '자카르타 MRT', fare: 'Rp3,000~14,000' },
      { kind: 'rail', name: '고속철도 Whoosh·공항철도' },
      { kind: 'taxi', name: 'Grab·Gojek·블루버드 택시' },
    ],
    transfer: 'MRT·LRT·트랜스자카르타는 180분 안에\n최대 Rp10,000까지만 내요',
    apps: ['Google 지도', 'Grab', 'Gojek', 'JAKI / JakLingko'],
    url: 'https://jakartamrt.co.id',
  },
  PH: {
    modes: [
      { kind: 'metro', name: '마닐라 LRT-1·LRT-2', fare: '비프 카드 ₱13~' },
      { kind: 'metro', name: '마닐라 MRT-3', fare: '약 ₱13~28' },
      { kind: 'bus', name: 'P2P 버스·지프니' },
      { kind: 'taxi', name: 'Grab' },
    ],
    transfer: '노선마다 요금을 따로 내요',
    apps: ['Google 지도', 'Grab', 'Sakay.ph'],
    url: 'https://dotr.gov.ph',
  },
  US: {
    modes: [
      { kind: 'metro', name: '뉴욕 지하철', fare: 'OMNY $3' },
      { kind: 'bus', name: '뉴욕 시내버스', fare: '$3' },
      { kind: 'rail', name: '암트랙' },
      { kind: 'coach', name: '그레이하운드' },
      { kind: 'bike', name: '시티바이크 (뉴욕)' },
      { kind: 'taxi', name: 'Uber·Lyft' },
    ],
    transfer: '뉴욕은 지하철↔버스 2시간 안 1번 무료\nOMNY는 7일에 12번째부터 무료',
    apps: ['Google 지도', 'Citymapper', 'Uber', 'Lyft'],
    url: 'https://omny.info',
  },
  CA: {
    modes: [
      { kind: 'metro', name: '토론토 TTC 지하철·스트리트카', fare: '$3.30' },
      { kind: 'metro', name: '밴쿠버 스카이트레인' },
      { kind: 'rail', name: 'VIA 레일·UP 익스프레스' },
      { kind: 'bike', name: 'Bike Share Toronto·Mobi' },
      { kind: 'taxi', name: 'Uber·Lyft' },
    ],
    transfer: '토론토는 한 번 내면 2시간 동안\n지하철·버스·스트리트카 무제한',
    apps: ['Google 지도', 'Transit', 'Uber'],
    url: 'https://www.ttc.ca/Fares-and-passes',
  },
  GB: {
    modes: [
      { kind: 'metro', name: '런던 지하철', fare: '1존 £3.00~3.10' },
      { kind: 'bus', name: '런던 버스', fare: '£1.85 (2026-11~)' },
      { kind: 'rail', name: '내셔널 레일·엘리자베스선' },
      { kind: 'coach', name: '내셔널 익스프레스' },
      { kind: 'bike', name: '산탄데르 자전거' },
      { kind: 'taxi', name: '블랙캡·Uber' },
    ],
    transfer: '버스·트램은 1시간 안이면 몇 번 타도 한 요금\n하루 상한 있음 (1~2존 £8.90)',
    apps: ['Citymapper', 'TfL Go', 'Trainline', 'Uber'],
    url: 'https://tfl.gov.uk/fares',
  },
  FR: {
    modes: [
      { kind: 'metro', name: '파리 메트로·RER', fare: '€2.55' },
      { kind: 'bus', name: '파리 버스·트램', fare: '€2.05' },
      { kind: 'rail', name: 'TGV·TER' },
      { kind: 'coach', name: '플릭스버스' },
      { kind: 'bike', name: '벨리브 (Vélib’)' },
      { kind: 'taxi', name: 'G7·Uber' },
    ],
    transfer: '메트로·RER 표와 버스·트램 표는 따로예요\n서로 갈아탈 수 없어요',
    apps: ['Île-de-France Mobilités', 'Citymapper', 'SNCF Connect', 'Uber'],
    url: 'https://www.iledefrance-mobilites.fr',
  },
  DE: {
    modes: [
      { kind: 'metro', name: '베를린 U반·S반', fare: 'AB존 €4.00' },
      { kind: 'metro', name: '뮌헨 U반·S반', fare: 'M존 €4.20' },
      { kind: 'tram', name: '트램·버스 (같은 표)' },
      { kind: 'rail', name: 'ICE·IC' },
      { kind: 'coach', name: '플릭스버스' },
      { kind: 'bike', name: 'Nextbike·Lime' },
    ],
    transfer:
      '한 장의 표로 정해진 시간 안 갈아타기 가능\n도이칠란트티켓(월 €63)은 ICE·IC 빼고 전국',
    apps: ['DB Navigator', 'BVG Tickets', 'MVGO', 'FREENOW'],
    url: 'https://www.bahn.com',
  },
  IT: {
    modes: [
      { kind: 'metro', name: '로마 메트로·버스 (BIT)', fare: '€1.50' },
      { kind: 'metro', name: '밀라노 메트로·트램', fare: '€2.20' },
      { kind: 'rail', name: '트렌이탈리아·이탈로' },
      { kind: 'coach', name: '플릭스버스' },
      { kind: 'taxi', name: '택시 (FREENOW·itTaxi)' },
    ],
    transfer: '로마 BIT는 100분, 밀라노는 90분 동안\n버스·트램 갈아타기 가능 (지하철은 1번)',
    apps: ['Google 지도', 'Trenitalia', 'Italo', 'Moovit'],
    url: 'https://www.atac.roma.it',
  },
  ES: {
    modes: [
      { kind: 'metro', name: '마드리드 메트로', fare: '1회권 €1.50 (A존)' },
      { kind: 'metro', name: '바르셀로나 메트로·버스', fare: '1회권 €2.90' },
      { kind: 'rail', name: '렌페(AVE)·이릭·오우이고' },
      { kind: 'coach', name: 'ALSA 버스' },
      { kind: 'bike', name: 'BiciMAD (마드리드)' },
      { kind: 'taxi', name: 'Cabify·Uber·FREENOW' },
    ],
    transfer: '바르셀로나 T-casual(10회 €13)은\n75분 안 메트로·버스 갈아타기 포함',
    apps: ['Google 지도', 'Renfe', 'TMB App', 'Cabify'],
    url: 'https://www.tmb.cat',
  },
  CH: {
    modes: [
      { kind: 'tram', name: '취리히 트램·버스·S반', fare: '110존 CHF 4.70' },
      { kind: 'rail', name: 'SBB·빙하특급·산악열차' },
      { kind: 'bus', name: '포스트버스' },
      { kind: 'ferry', name: '호수 유람선' },
    ],
    transfer: '존 표 하나로 시간 안에 트램·버스·기차를\n모두 갈아탈 수 있어요',
    apps: ['SBB Mobile', 'Google 지도'],
    url: 'https://www.sbb.ch',
    note: '취리히 요금이 2026-12-13에 올라요',
  },
  AU: {
    modes: [
      { kind: 'metro', name: '시드니 기차·메트로 (오팔)', fare: '하루 상한 $19.30' },
      { kind: 'tram', name: '멜버른 트램 (마이키)', fare: '2시간 $5.70' },
      { kind: 'ferry', name: '시드니 페리' },
      { kind: 'bus', name: '시내버스' },
      { kind: 'coach', name: '그레이하운드' },
      { kind: 'taxi', name: 'Uber·DiDi' },
    ],
    transfer: '시드니는 주말 하루 상한 $9.65\n멜버른 도심은 트램이 무료 (안에서만 탈 때)',
    apps: ['Opal Travel', 'PTV', 'Google 지도', 'Uber'],
    url: 'https://transportnsw.info',
    note: '멜버른 마이키는 2027-01-01까지 반값이에요',
  },
  NZ: {
    modes: [
      { kind: 'bus', name: '오클랜드 버스·기차 (AT HOP)' },
      { kind: 'ferry', name: '오클랜드 페리' },
      { kind: 'rail', name: '키위레일' },
      { kind: 'coach', name: '인터시티 버스' },
      { kind: 'taxi', name: 'Uber' },
    ],
    transfer: 'AT HOP·카드 찍기는 같은 요금\nHOP는 7일 상한 $50',
    apps: ['AT Mobile', 'Google 지도', 'Uber'],
    url: 'https://at.govt.nz',
  },
  GU: {
    modes: [
      { kind: 'bus', name: '레드 셔틀 (관광객용)', fare: '1회 $7 · 1일 $15' },
      { kind: 'bus', name: '공영버스 (일요일·공휴일 쉼)' },
      { kind: 'taxi', name: '택시·렌터카' },
    ],
    transfer: '환승 할인은 없어요\n대부분 렌터카나 셔틀로 다녀요',
    apps: ['Google 지도', '레드 셔틀 예약'],
    url: 'https://guamredshuttle.com',
  },
  MP: {
    modes: [
      { kind: 'bus', name: '호텔·면세점 셔틀' },
      { kind: 'taxi', name: '택시', fare: '공항→가라판 약 $25~30' },
    ],
    transfer: '대중교통이 거의 없어요\n렌터카·택시 위주예요',
    apps: ['Google 지도'],
    url: 'https://www.mymarianas.com',
  },
};

export const transitGuideFor = (country: string): CountryTransit | null =>
  TRANSIT_GUIDE[country] ?? null;
