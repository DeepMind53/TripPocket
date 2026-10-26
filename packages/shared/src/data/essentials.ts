/**
 * 나라별 입국 필수 항목 (docs/19, 사용자 요청 2026-10-25) — 한국 여권·관광 기준
 * 2026-10-25에 각 나라 공식 사이트·주재 한국 공관 공지·외교부 해외안전여행으로 확인했다
 * 규정은 자주 바뀐다 → 화면에 확인 날짜·공식 링크를 함께 보여 주고, CHECKED_AT이 오래되면 "출처에서 확인" 안내
 * 고칠 때: 이 파일만 고치고 CHECKED_AT·sources를 갱신한다
 */

export const ESSENTIALS_CHECKED_AT = '2026-10-27';

export type EssentialLevel = 'must' | 'recommend' | 'tip';

export interface EssentialItem {
  /** 나라 안에서 고유 (체크 상태 저장 키) */
  id: string;
  level: EssentialLevel;
  title: string;
  /** 한두 줄 설명 (줄바꿈 \n) */
  desc: string;
  url?: string;
  /** 출발 며칠 전부터 낼 수 있는지 (입국신고 등) — 그 안에 들어오면 알림 */
  fromDaysBefore?: number;
  /** 앱이 스스로 판단해 체크하는 항목 */
  auto?: 'visaFree' | 'passport' | 'transfer' | 'checkin' | 'returnFlight';
}

export interface CountryEssentials {
  /** 이 데이터를 쓰는 나라 코드들 (괌·사이판처럼 묶음) */
  codes: readonly string[];
  name: string;
  /** 무비자 체류 가능 일수 (전자여행허가가 따로 필요해도 적음). 없으면 비자 필요 */
  visaFreeDays?: number;
  /** 여권 남은 기간 기준: 귀국일 + N개월 ('stay' = 머무는 동안만 유효하면 됨) */
  passportMonths: number | 'stay';
  items: readonly EssentialItem[];
  sources: readonly { label: string; url: string }[];
}

const MOFA = { label: '외교부 해외안전여행', url: 'https://www.0404.go.kr' };

/** 모든 나라 공통 (여행자 입장에서 꼭 챙길 것) */
export const COMMON_ESSENTIALS: readonly EssentialItem[] = [
  {
    id: 'airportTransfer',
    level: 'must',
    title: '공항 ↔ 숙소 이동 방법',
    desc: '픽업·드랍 예약이 있으면 자동 체크돼요\n없으면 공항철도·버스·택시를 미리 확인해 두세요',
    auto: 'transfer',
  },
  {
    id: 'checkin',
    level: 'must',
    title: '숙소 체크인 시간',
    desc: '늦게 도착하면 24시간 프런트인지 숙소에 미리 알려 두세요',
    auto: 'checkin',
  },
  {
    id: 'insurance',
    level: 'recommend',
    title: '여행자보험',
    desc: '해외 병원비는 비싸요\n휴대품 도난·항공 지연 보장도 확인하세요',
  },
  {
    // docs/20 G3 — 앱 지도는 인터넷이 있어야 보여서, 지도 앱의 오프라인 지도를 미리
    id: 'offlineMap',
    level: 'recommend',
    title: '오프라인 지도 받기',
    desc: 'Google 지도 앱 → 프로필 → 오프라인 지도에서 여행지를 받아 두세요\n트립포켓 일정·주소는 인터넷 없이도 보여요',
    url: 'https://support.google.com/maps/answer/6291838?hl=ko',
  },
  {
    id: 'data',
    level: 'recommend',
    title: '데이터 (eSIM·유심·로밍)',
    desc: '공항에서 지도·번역·택시 앱을 바로 써야 해요',
  },
  {
    id: 'card',
    level: 'recommend',
    title: '해외 결제 카드·현금',
    desc: '해외 결제 되는 카드 1장 + 비상용 현금.\n카드 해외 결제 차단 설정을 확인하세요',
  },
  {
    id: 'emergency',
    level: 'tip',
    title: '긴급 연락처',
    desc: '영사콜센터 +82-2-3210-0404 (24시간)\n여권 분실 시 가까운 한국 공관',
    url: 'https://www.0404.go.kr',
  },
];

const passportItem = (desc: string): EssentialItem => ({
  id: 'passport',
  level: 'must',
  title: '여권 유효기간',
  desc,
  auto: 'passport',
});
const visaFreeItem = (days: number, extra = ''): EssentialItem => ({
  id: 'visa',
  level: 'must',
  title: '비자',
  desc: `한국인 무비자 ${days}일 (관광)${extra ? `\n${extra}` : ''}`,
  auto: 'visaFree',
});
const returnItem = (
  desc = '입국 심사에서 귀국·다음 나라 항공권을 물어볼 수 있어요',
): EssentialItem => ({
  id: 'returnTicket',
  level: 'must',
  title: '귀국(다음 행선지) 항공권',
  desc,
  auto: 'returnFlight',
});
const plug = (desc: string): EssentialItem => ({
  id: 'power',
  level: 'tip',
  title: '전압·플러그',
  desc,
});

export const COUNTRY_ESSENTIALS: readonly CountryEssentials[] = [
  {
    codes: ['JP'],
    name: '일본',
    visaFreeDays: 90,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요'),
      visaFreeItem(90, '전자여행허가(JESTA)는 아직 시행 전이에요'),
      {
        id: 'arrival',
        level: 'must',
        title: '입국·세관 신고 (Visit Japan Web)',
        desc: '온라인으로 미리 내고 QR을 보여 주면 빨라요\n종이 신고서로도 가능해요',
        url: 'https://www.vjw.digital.go.jp/',
      },
      {
        id: 'taxFree',
        level: 'tip',
        title: '면세 방식 변경 (2026.11.1부터)',
        desc: '매장 즉시 면세 → 세금 포함 결제 후 출국 때 환급.\n여권 원본을 꼭 들고 다니세요',
      },
      {
        id: 'transit',
        level: 'tip',
        title: '교통카드',
        desc: 'Suica·PASMO·ICOCA (아이폰 지갑 앱에 넣을 수 있어요)',
      },
      plug('100V, 납작한 2구(A형) — 돼지코 어댑터가 필요해요'),
    ],
    sources: [
      { label: 'Visit Japan Web', url: 'https://www.vjw.digital.go.jp/' },
      { label: '일본 출입국재류관리청', url: 'https://www.moj.go.jp/isa/' },
      MOFA,
    ],
  },
  {
    codes: ['VN'],
    name: '베트남',
    visaFreeDays: 45,
    passportMonths: 6,
    items: [
      passportItem('입국일 기준 6개월 이상 남아야 해요.\n빈 면도 2쪽 이상 남겨 두세요'),
      visaFreeItem(45, '45일보다 길면 전자비자(e-Visa)가 필요해요'),
      {
        id: 'arrival',
        level: 'must',
        title: '사전 입국신고 (Pre-Arrival)',
        desc: '호찌민(탄손녓)부터 의무, 다른 공항으로 넓혀지는 중.\n도착 72시간 전부터, 무료',
        url: 'https://prearrival.immigration.gov.vn/',
        fromDaysBefore: 3,
      },
      returnItem('45일 안에 나가는 항공권이 있어야 해요'),
      {
        id: 'transit',
        level: 'tip',
        title: '이동',
        desc: '그랩(Grab) 앱 — 택시 바가지를 피할 수 있어요',
      },
      plug('220V, 한국 플러그 대부분 그대로 써요'),
    ],
    sources: [
      { label: '베트남 사전 입국신고 (이민국)', url: 'https://prearrival.immigration.gov.vn/' },
      { label: '베트남 전자비자', url: 'https://evisa.gov.vn/' },
      MOFA,
    ],
  },
  {
    codes: ['CN'],
    name: '중국',
    visaFreeDays: 30,
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남아 있는 것이 안전해요'),
      visaFreeItem(30, '2026.12.31까지 한시 무비자예요. 그 뒤는 다시 확인하세요'),
      {
        id: 'arrival',
        level: 'must',
        title: '입국카드',
        desc: '온라인으로 미리 내거나(무료) 공항에서 종이로 써요\n유료 대행 사이트 주의',
        url: 'https://s.nia.gov.cn/ArrivalCardFillingPC/',
      },
      {
        id: 'payment',
        level: 'must',
        title: '알리페이·위챗페이',
        desc: '카드·현금을 안 받는 곳이 많아요\n출국 전 앱에 한국 카드를 연결해 두세요',
      },
      {
        id: 'apps',
        level: 'recommend',
        title: '구글·카카오톡 접속',
        desc: '중국 인터넷에서는 막혀요\n로밍이나 해외 eSIM이면 대부분 써요',
      },
      {
        id: 'idCarry',
        level: 'tip',
        title: '여권 늘 지참',
        desc: '호텔·기차·관광지 입장에 여권이 필요해요',
      },
      plug('220V, 한국 플러그 대부분 그대로 (일부 어댑터 필요)'),
    ],
    sources: [
      { label: '중국 국가이민관리국 입국카드', url: 'https://s.nia.gov.cn/ArrivalCardFillingPC/' },
      { label: '주한 중국대사관', url: 'http://kr.china-embassy.gov.cn/kor/' },
      MOFA,
    ],
  },
  {
    codes: ['TH'],
    name: '태국',
    visaFreeDays: 90,
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남아야 해요'),
      visaFreeItem(90, '다른 나라는 30일로 줄었지만 한국은 협정으로 90일이에요'),
      {
        id: 'arrival',
        level: 'must',
        title: '디지털 입국카드 (TDAC)',
        desc: '입국 3일 전부터 무료로 제출해요\n유료 대행 사이트 주의',
        url: 'https://tdac.immigration.go.th/',
        fromDaysBefore: 3,
      },
      returnItem(),
      {
        id: 'vape',
        level: 'must',
        title: '전자담배 반입 금지',
        desc: '전자담배는 불법이에요\n벌금·체포될 수 있어요',
      },
      { id: 'transit', level: 'tip', title: '이동', desc: '그랩·볼트 앱, 방콕은 래빗카드(BTS)' },
      plug('220V, 한국 플러그 대부분 그대로 써요'),
    ],
    sources: [
      { label: '태국 TDAC (이민국)', url: 'https://tdac.immigration.go.th/' },
      {
        label: '주태국 한국대사관 공지',
        url: 'https://www.mofa.go.kr/th-ko/brd/m_25795/view.do?seq=1347228',
      },
      MOFA,
    ],
  },
  {
    codes: ['PH'],
    name: '필리핀',
    visaFreeDays: 30,
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남은 여권이 안전해요'),
      visaFreeItem(30),
      {
        id: 'arrival',
        level: 'must',
        title: 'eTravel 등록',
        desc: '도착 72시간 전부터, 무료. QR을 저장해 두세요\n출국할 때도 등록해요',
        url: 'https://etravel.gov.ph/',
        fromDaysBefore: 3,
      },
      returnItem('30일 안에 나가는 확정 항공권이 필요해요'),
      { id: 'transit', level: 'tip', title: '이동', desc: '그랩 앱이 편하고 안전해요' },
      plug('220V, 납작한 2구(A형)가 많아 어댑터를 챙기세요'),
    ],
    sources: [{ label: '필리핀 eTravel', url: 'https://etravel.gov.ph/' }, MOFA],
  },
  {
    codes: ['TW'],
    name: '대만',
    visaFreeDays: 90,
    passportMonths: 6,
    items: [
      passportItem('입국 때 6개월 이상 남아야 해요'),
      visaFreeItem(90),
      {
        id: 'arrival',
        level: 'must',
        title: '온라인 입국카드 (TWAC)',
        desc: '2025.10.1부터 종이 신고서가 없어졌어요\n도착 7일 전부터 낼 수 있어요',
        url: 'https://twac.immigration.gov.tw/',
        fromDaysBefore: 7,
      },
      returnItem('왕복이나 다음 행선지 항공권이 없으면 입국이 거절될 수 있어요'),
      {
        id: 'transit',
        level: 'tip',
        title: '교통카드',
        desc: '이지카드(EasyCard) — 지하철·버스·편의점',
      },
      plug('110V, 납작한 2구(A형) — 돼지코 어댑터가 필요해요'),
    ],
    sources: [
      { label: '대만 온라인 입국카드', url: 'https://twac.immigration.gov.tw/' },
      { label: '주타이베이 한국대표부', url: 'https://overseas.mofa.go.kr/tw-ko/index.do' },
      MOFA,
    ],
  },
  {
    codes: ['US'],
    name: '미국',
    visaFreeDays: 90,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요 (전자여권)'),
      {
        id: 'visa',
        level: 'must',
        title: '전자여행허가 (ESTA)',
        desc: '출발 72시간 전까지 신청 (US$40.62).\n공식 사이트만 이용하세요',
        url: 'https://esta.cbp.dhs.gov/',
      },
      returnItem(),
      { id: 'tip', level: 'tip', title: '팁', desc: '식당은 보통 15~20% 팁을 더해요' },
      plug('110V, 납작한 2구(A형) — 돼지코 어댑터가 필요해요'),
    ],
    sources: [{ label: '미국 ESTA (CBP)', url: 'https://esta.cbp.dhs.gov/' }, MOFA],
  },
  {
    codes: ['GU', 'MP'],
    name: '괌·사이판',
    visaFreeDays: 45,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요'),
      {
        id: 'visa',
        level: 'must',
        title: '전자여행허가 (G-CNMI ETA 또는 ESTA)',
        desc: 'G-CNMI ETA는 무료, 출발 5일 전까지 신청.\n이미 ESTA가 있으면 필요 없어요',
        url: 'https://g-cnmi-eta.cbp.dhs.gov/',
      },
      returnItem(),
      {
        id: 'drive',
        level: 'tip',
        title: '렌터카',
        desc: '국제운전면허증 또는 영문 운전면허증을 챙기세요',
      },
      plug('110V, 납작한 2구(A형) — 돼지코 어댑터가 필요해요'),
    ],
    sources: [
      { label: 'G-CNMI ETA (CBP)', url: 'https://g-cnmi-eta.cbp.dhs.gov/' },
      {
        label: '외교부 괌·사이판 입국 안내',
        url: 'https://overseas.mofa.go.kr/us-ko/brd/m_27214/view.do?seq=1343922',
      },
    ],
  },
  {
    codes: ['SG'],
    name: '싱가포르',
    visaFreeDays: 90,
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남아야 해요'),
      visaFreeItem(90),
      {
        id: 'arrival',
        level: 'must',
        title: '입국카드 (SG Arrival Card)',
        desc: '도착 3일 전부터 무료로 제출해요',
        url: 'https://eservices.ica.gov.sg/sgarrivalcard/',
        fromDaysBefore: 3,
      },
      {
        id: 'rules',
        level: 'must',
        title: '반입 금지',
        desc: '전자담배는 반입·사용 모두 금지예요\n껌도 판매 목적 반입 금지',
      },
      {
        id: 'transit',
        level: 'tip',
        title: '교통',
        desc: '비자·마스터 컨택리스 카드로 지하철·버스를 바로 타요',
      },
      plug('230V, 각진 3구(G형) — 어댑터가 필요해요'),
    ],
    sources: [
      { label: 'SG Arrival Card (ICA)', url: 'https://eservices.ica.gov.sg/sgarrivalcard/' },
      { label: '주싱가포르 한국대사관', url: 'https://overseas.mofa.go.kr/sg-ko/index.do' },
      MOFA,
    ],
  },
  {
    codes: ['HK'],
    name: '홍콩',
    visaFreeDays: 90,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 기간보다 1개월 이상 남아 있으면 안전해요'),
      visaFreeItem(90, '입국신고서는 없어요'),
      {
        id: 'transit',
        level: 'tip',
        title: '교통카드',
        desc: '옥토퍼스 카드 (아이폰 지갑 앱 가능)',
      },
      plug('220V, 각진 3구(G형) — 어댑터가 필요해요'),
    ],
    sources: [{ label: '홍콩 이민국', url: 'https://www.immd.gov.hk/' }, MOFA],
  },
  {
    codes: ['MO'],
    name: '마카오',
    visaFreeDays: 90,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요'),
      visaFreeItem(90, '입국신고서는 없어요'),
      { id: 'transit', level: 'tip', title: '이동', desc: '호텔 무료 셔틀버스가 많아요' },
      plug('220V, 각진 3구(G형)가 많아 어댑터를 챙기세요'),
    ],
    sources: [{ label: '마카오 치안경찰국', url: 'https://www.fsm.gov.mo/' }, MOFA],
  },
  {
    codes: ['ID'],
    name: '인도네시아 (발리 등)',
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남아야 해요'),
      {
        id: 'visa',
        level: 'must',
        title: '도착비자 (e-VOA)',
        desc: '미리 온라인으로 받으면 빨라요 (IDR 500,000, 30일).\n공식 사이트만 이용하세요',
        url: 'https://evisa.imigrasi.go.id/',
      },
      {
        id: 'arrival',
        level: 'must',
        title: '통합 입국신고 (All Indonesia)',
        desc: '입국·세관·검역 신고를 한 번에, 무료.\n도착 72시간 전부터, QR 저장',
        url: 'https://allindonesia.imigrasi.go.id/',
        fromDaysBefore: 3,
      },
      {
        id: 'baliLevy',
        level: 'must',
        title: '발리 관광세 (발리만)',
        desc: 'IDR 150,000, 방문마다 한 번.\n공식 Love Bali에서만 내세요',
        url: 'https://lovebali.baliprov.go.id/',
      },
      returnItem(),
      plug('230V, 한국 플러그 그대로 써요'),
    ],
    sources: [
      { label: '인도네시아 e-VOA (이민국)', url: 'https://evisa.imigrasi.go.id/' },
      { label: 'All Indonesia', url: 'https://allindonesia.imigrasi.go.id/' },
      { label: 'Love Bali', url: 'https://lovebali.baliprov.go.id/' },
      MOFA,
    ],
  },
  {
    codes: ['MY'],
    name: '말레이시아',
    visaFreeDays: 90,
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남아야 해요'),
      visaFreeItem(90),
      {
        id: 'arrival',
        level: 'must',
        title: '디지털 입국카드 (MDAC)',
        desc: '도착 3일 전부터 무료로 등록해요\n유료 대행 사이트 주의',
        url: 'https://imigresen-online.imi.gov.my/mdac/main',
        fromDaysBefore: 3,
      },
      returnItem(),
      {
        id: 'transit',
        level: 'tip',
        title: '이동',
        desc: '그랩 앱, 쿠알라룸푸르는 터치앤고 카드',
      },
      plug('240V, 각진 3구(G형) — 어댑터가 필요해요'),
    ],
    sources: [
      { label: 'MDAC (말레이시아 이민국)', url: 'https://imigresen-online.imi.gov.my/mdac/main' },
      {
        label: '외교부 MDAC 공지',
        url: 'https://overseas.mofa.go.kr/my-kk-ko/brd/m_25987/view.do?seq=39&page=1',
      },
    ],
  },
  {
    codes: ['AU'],
    name: '호주',
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요'),
      {
        id: 'visa',
        level: 'must',
        title: '전자여행허가 (ETA 앱)',
        desc: 'Australian ETA 앱으로 신청 (수수료 AUD 20).\n승인까지 며칠 걸릴 수 있어요',
        url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601',
      },
      {
        id: 'biosecurity',
        level: 'must',
        title: '음식·동식물 신고',
        desc: '검역이 엄격해요\n음식은 꼭 신고하세요\n신고 안 하면 큰 벌금',
      },
      plug('230V, 八자 2구(I형) — 어댑터가 필요해요'),
    ],
    sources: [
      {
        label: '호주 내무부 ETA',
        url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601',
      },
      MOFA,
    ],
  },
  {
    codes: ['MN'],
    name: '몽골',
    visaFreeDays: 90,
    passportMonths: 6,
    items: [
      passportItem('6개월 이상 남아 있는 것이 안전해요'),
      visaFreeItem(90, '2026.12.31까지 관광 무비자예요'),
      { id: 'cash', level: 'tip', title: '현금', desc: '지방은 카드가 안 되는 곳이 많아요' },
      plug('220V, 한국 플러그 그대로 써요'),
    ],
    sources: [
      {
        label: '주몽골 한국대사관 공지',
        url: 'https://mn.mofa.go.kr/mn-ko/brd/m_373/view.do?seq=1339476',
      },
      MOFA,
    ],
  },
  ...(['FR', 'IT', 'ES'] as const).map((code): CountryEssentials => ({
    codes: [code],
    name: { FR: '프랑스', IT: '이탈리아', ES: '스페인' }[code],
    visaFreeDays: 90,
    passportMonths: 3,
    items: [
      passportItem('쉥겐 출국일 기준 3개월 이상, 발급 10년 이내'),
      visaFreeItem(90, '쉥겐 나라 합쳐 180일 중 90일이에요'),
      {
        id: 'ees',
        level: 'must',
        title: '출입국 시스템 (EES)',
        desc: '처음 입국할 때 지문·얼굴을 등록해요 (무료).\n심사 줄이 길 수 있어요',
        url: 'https://travel-europe.europa.eu/ees_en',
      },
      {
        id: 'etias',
        level: 'tip',
        title: '유럽 전자여행허가 (ETIAS)',
        desc: '아직 시행 전이에요 (시작일 미정)',
        url: 'https://travel-europe.europa.eu/etias_en',
      },
      {
        id: 'proof',
        level: 'recommend',
        title: '숙소·귀국 항공권 증빙',
        desc: '입국 심사에서 물어볼 수 있어요\n예약 확인서를 휴대폰에 저장해 두세요',
      },
      {
        id: 'pickpocket',
        level: 'tip',
        title: '소매치기 주의',
        desc: '관광지·지하철에서 가방을 앞으로 메세요',
      },
      {
        id: 'cityTax',
        level: 'tip',
        title: '숙박세',
        desc: '호텔에서 도시세를 현장에서 따로 받는 경우가 많아요',
      },
      plug('230V, 한국 플러그 그대로 써요'),
    ],
    sources: [
      { label: 'EU EES', url: 'https://travel-europe.europa.eu/ees_en' },
      { label: 'EU ETIAS', url: 'https://travel-europe.europa.eu/etias_en' },
      MOFA,
    ],
  })),
  {
    codes: ['GB'],
    name: '영국',
    visaFreeDays: 180,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요'),
      {
        id: 'visa',
        level: 'must',
        title: '전자여행허가 (UK ETA)',
        desc: 'GOV.UK·공식 앱으로 신청 (£20, 2년).\n여권을 새로 받으면 다시 신청해요',
        url: 'https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta',
      },
      {
        id: 'transit',
        level: 'tip',
        title: '교통',
        desc: '컨택리스 카드로 지하철·버스를 바로 타요',
      },
      plug('230V, 각진 3구(G형) — 어댑터가 필요해요'),
    ],
    sources: [
      {
        label: 'GOV.UK ETA',
        url: 'https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta',
      },
      MOFA,
    ],
  },
  {
    codes: ['CA'],
    name: '캐나다',
    visaFreeDays: 180,
    passportMonths: 'stay',
    items: [
      passportItem('머무는 동안 유효하면 돼요'),
      {
        id: 'visa',
        level: 'must',
        title: '전자여행허가 (eTA)',
        desc: '항공 입국 전 신청 (CAD 7, 최대 5년).\n공식 사이트만 이용하세요',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html',
      },
      { id: 'tip', level: 'tip', title: '팁', desc: '식당은 보통 15~20% 팁을 더해요' },
      plug('120V, 납작한 2구(A형) — 돼지코 어댑터가 필요해요'),
    ],
    sources: [
      {
        label: '캐나다 eTA',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html',
      },
      MOFA,
    ],
  },
];

export const essentialsFor = (countryCode: string | undefined): CountryEssentials | undefined =>
  countryCode ? COUNTRY_ESSENTIALS.find((c) => c.codes.includes(countryCode)) : undefined;

/** 여권이 이 날짜까지는 유효해야 한다 (귀국일 기준) */
export function passportNeededUntil(endDate: string, months: number | 'stay'): string {
  if (months === 'stay') return endDate;
  const [y, m, d] = endDate.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** 체크 상태 저장 키 (준비 목록 essentials의 text) */
export const essentialKey = (country: string, id: string) => `${country}:${id}`;

/**
 * 나라별 이벤트·혜택 (사용자 요청 2026-10-25): 누구나 응모·신청할 수 있는 것만.
 * until이 지나면 화면에서 안 보인다. 매달 반복 작업(docs/22)에서 새 이벤트를 찾아 더한다
 */
export interface TravelEvent {
  id: string;
  /** 보여 줄 나라 (여행 목적지가 이 중 하나면) */
  codes: readonly string[];
  title: string;
  desc: string;
  url: string;
  /** 시작·끝 (YYYY-MM-DD, 끝 날 포함) */
  from: string;
  until: string;
  checkedAt: string;
}

export const TRAVEL_EVENTS: readonly TravelEvent[] = [
  {
    id: 'tw-lucky-2026',
    codes: ['TW'],
    title: '대만 여행 지원금 추첨 (재방문 NT$5,000)',
    desc: '도착 7~90일 전에 온라인 등록 → 매주 수요일 추첨\n재방문 NT$5,000, 동행 NT$3,000 소비 지원금 · 3~90일 개별 여행',
    url: 'https://5000.taiwan.net.tw/campaign_rules_kr.html',
    from: '2026-10-01',
    until: '2027-03-24',
    checkedAt: '2026-10-27',
  },
  {
    id: 'mo-free-coach-2026',
    codes: ['MO', 'HK'],
    title: '홍콩공항 → 마카오 무료 버스 (편도)',
    desc: '홍콩국제공항으로 들어와 마카오로 가는 외국인 여행자\nE2 환승 구역 38~40번 창구에서 받아요 (여권 지참)',
    url: 'https://www.macauhkairportbus.com/news/79',
    from: '2026-01-20',
    until: '2026-12-31',
    checkedAt: '2026-10-27',
  },
];

/** 이 나라들의 지금 진행 중인(또는 여행 중에 열리는) 이벤트 */
export function eventsFor(codes: readonly string[], today: string, tripEnd: string): TravelEvent[] {
  return TRAVEL_EVENTS.filter(
    (e) => e.codes.some((c) => codes.includes(c)) && e.until >= today && e.from <= tripEnd,
  );
}
