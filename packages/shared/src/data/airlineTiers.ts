/**
 * 항공사 회원 등급 (마이 → 개인정보 → 항공사 회원번호, 사용자 요청 2026-11-02).
 * 항공사를 고르거나 적으면 그 회원 프로그램의 등급을 칩으로 보여 준다. 매달 갱신 목록에서 확인 (docs/monthlyUpdate)
 */
export interface AirlineProgram {
  code: string;
  /** 화면 이름 (칩·자동 입력) */
  name: string;
  /** 회원 이름이 이 중 하나를 포함하면 이 항공사로 본다 (소문자·공백 무시) */
  aliases: readonly string[];
  program: string;
  tiers: readonly string[];
}

export const AIRLINE_TIERS_CHECKED_AT = '2026-11-03';
/** 공식 사이트·여러 자료로 확인한 프로그램 (나머지는 월간 갱신에서 공식 확인) */
export const AIRLINE_TIERS_VERIFIED = ['KE', 'OZ', 'CI', 'VN', 'DL', 'UA', 'AA', 'AF'] as const;

export const AIRLINE_PROGRAMS: readonly AirlineProgram[] = [
  {
    code: 'KE',
    name: '대한항공',
    aliases: ['대한항공', 'koreanair', 'skypass'],
    program: 'SKYPASS',
    tiers: ['일반', '모닝캄', '모닝캄 프리미엄', '밀리언 마일러'],
  },
  {
    code: 'OZ',
    name: '아시아나항공',
    aliases: ['아시아나', 'asiana'],
    program: '아시아나클럽',
    tiers: ['일반', '골드', '다이아몬드', '다이아몬드 플러스', '플래티늄'],
  },
  {
    code: 'JL',
    name: '일본항공',
    aliases: ['일본항공', 'jal', 'japanairlines'],
    program: 'JAL 마일리지 뱅크',
    tiers: ['일반', '크리스탈', '사파이어', 'JGC 프리미어', '다이아몬드'],
  },
  {
    code: 'NH',
    name: 'ANA',
    aliases: ['ana', '전일본공수', 'allnippon'],
    program: 'ANA 마일리지 클럽',
    tiers: ['일반', '브론즈', '플래티넘', '다이아몬드'],
  },
  {
    code: 'CX',
    name: '캐세이퍼시픽',
    aliases: ['캐세이', 'cathay'],
    program: '캐세이',
    tiers: ['그린', '실버', '골드', '다이아몬드'],
  },
  {
    code: 'SQ',
    name: '싱가포르항공',
    aliases: ['싱가포르항공', 'singapore'],
    program: '크리스플라이어',
    tiers: ['일반', '엘리트 실버', '엘리트 골드', 'PPS 클럽', '솔리테어 PPS'],
  },
  {
    code: 'BR',
    name: '에바항공',
    aliases: ['에바', 'eva'],
    program: '인피니티 마일리지랜드',
    tiers: ['그린', '실버', '골드', '다이아몬드'],
  },
  {
    code: 'CI',
    name: '중화항공',
    aliases: ['중화항공', 'chinaairlines', 'dynasty'],
    program: '다이너스티 플라이어',
    tiers: ['다이너스티', '골드', '에메랄드', '패러곤'],
  },
  {
    code: 'TG',
    name: '타이항공',
    aliases: ['타이항공', 'thai'],
    program: '로열 오키드 플러스',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'VN',
    name: '베트남항공',
    aliases: ['베트남항공', 'vietnamairlines', 'lotusmiles'],
    program: '로터스마일즈',
    tiers: ['일반', '실버', '티타늄', '골드', '플래티넘'],
  },
  {
    code: 'DL',
    name: '델타항공',
    aliases: ['델타', 'delta'],
    program: '스카이마일스',
    tiers: ['일반', '실버 메달리온', '골드 메달리온', '플래티넘 메달리온', '다이아몬드 메달리온'],
  },
  {
    code: 'UA',
    name: '유나이티드항공',
    aliases: ['유나이티드', 'united'],
    program: '마일리지플러스',
    tiers: ['일반', '프리미어 실버', '프리미어 골드', '프리미어 플래티넘', '프리미어 1K'],
  },
  {
    code: 'AA',
    name: '아메리칸항공',
    aliases: ['아메리칸', 'americanairlines'],
    program: 'AAdvantage',
    tiers: ['일반', '골드', '플래티넘', '플래티넘 프로', '이그제큐티브 플래티넘'],
  },
  {
    code: 'EK',
    name: '에미레이트항공',
    aliases: ['에미레이트', 'emirates'],
    program: '스카이워즈',
    tiers: ['블루', '실버', '골드', '플래티넘'],
  },
  {
    code: 'QR',
    name: '카타르항공',
    aliases: ['카타르', 'qatar'],
    program: '프리빌리지 클럽',
    tiers: ['버건디', '실버', '골드', '플래티넘'],
  },
  {
    code: 'AF',
    name: '에어프랑스',
    aliases: ['에어프랑스', 'airfrance', 'flyingblue'],
    program: '플라잉블루',
    tiers: ['익스플로러', '실버', '골드', '플래티넘', '얼티밋'],
  },
  {
    code: 'LH',
    name: '루프트한자',
    aliases: ['루프트한자', 'lufthansa', 'milesandmore'],
    program: '마일스앤모어',
    tiers: ['일반', '프리퀀트 트래블러', '세너터', 'HON 서클'],
  },
  // LCC (2026-11-03): 우수 등급 제도가 없는 곳은 tiers = [] → 화면에 "등급 없음".
  // 공식 확인 전이라 월간 갱신에서 확인 (진에어·에어부산·에어서울은 통합 진에어 출범 예정, 티웨이는 브랜드 변경 보도)
  {
    code: '7C',
    name: '제주항공',
    aliases: ['제주항공', 'jejuair'],
    program: '리프레시 포인트',
    tiers: [],
  },
  { code: 'LJ', name: '진에어', aliases: ['진에어', 'jinair'], program: '나비포인트', tiers: [] },
  {
    code: 'TW',
    name: '트리니티항공',
    // 2026 티웨이항공 → 트리니티항공 사명 변경 (예약·예전 이름도 찾게)
    aliases: ['트리니티', 'trinity', '티웨이', 'tway'],
    program: '트리니티 회원',
    tiers: [],
  },
  {
    code: 'BX',
    name: '에어부산',
    aliases: ['에어부산', 'airbusan'],
    program: '아시아나클럽 적립',
    tiers: [],
  },
  {
    code: 'RS',
    name: '에어서울',
    aliases: ['에어서울', 'airseoul'],
    program: '민트포인트',
    tiers: [],
  },
  {
    code: 'ZE',
    name: '이스타항공',
    aliases: ['이스타', 'eastar'],
    program: '이스타 멤버십',
    tiers: [],
  },
  {
    code: 'RF',
    name: '에어로케이',
    aliases: ['에어로케이', 'aerok'],
    program: '에어로케이 회원',
    tiers: [],
  },
  {
    code: 'YP',
    name: '에어프레미아',
    aliases: ['에어프레미아', 'airpremia'],
    program: '에어프레미아 회원',
    tiers: [],
  },
  // 국내 지역·신생 항공사 (2026-11-03) — IATA 코드를 확인하지 못한 곳은 영문 표시 코드(목록 키 전용)
  {
    code: 'PARATA',
    name: '파라타항공',
    aliases: ['파라타', 'parata', '플라이강원', 'flygangwon'],
    program: '파라타 회원',
    tiers: [],
  },
  {
    code: '4H',
    name: '하이에어',
    aliases: ['하이에어', 'hiair'],
    program: '하이에어 회원',
    tiers: [],
  },
  {
    code: 'SUMAIR',
    name: '섬에어',
    aliases: ['섬에어', 'sumair'],
    program: '섬에어 회원',
    tiers: [],
  },
  // ── 해외 (2026-11-03 추가, 등급 이름은 월간 갱신에서 공식 확인) ──
  {
    code: 'CA',
    name: '중국국제항공',
    aliases: ['중국국제항공', '에어차이나', 'airchina', 'phoenixmiles'],
    program: '피닉스마일즈',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'MU',
    name: '중국동방항공',
    aliases: ['중국동방', '동방항공', 'chinaeastern', 'easternmiles'],
    program: '이스턴 마일즈',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'CZ',
    name: '중국남방항공',
    aliases: ['중국남방', '남방항공', 'chinasouthern'],
    program: '스카이펄 클럽',
    tiers: ['일반', '실버', '골드'],
  },
  {
    code: 'SC',
    name: '산둥항공',
    aliases: ['산둥항공', 'shandong'],
    program: '피닉스마일즈',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'NX',
    name: '에어마카오',
    aliases: ['에어마카오', 'airmacau'],
    program: '피닉스마일즈',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'HO',
    name: '길상항공',
    aliases: ['길상항공', '준야오', 'juneyao'],
    program: '준야오 클럽',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'HX',
    name: '홍콩항공',
    aliases: ['홍콩항공', 'hongkongairlines'],
    program: '포춘윙스 클럽',
    tiers: ['일반', '실버', '골드', '플래티넘'],
  },
  {
    code: 'PR',
    name: '필리핀항공',
    aliases: ['필리핀항공', 'philippineairlines', 'mabuhay'],
    program: '마부하이 마일즈',
    tiers: ['클래식', '엘리트', '프리미어 엘리트', '밀리언 마일러'],
  },
  {
    code: 'MH',
    name: '말레이시아항공',
    aliases: ['말레이시아항공', 'malaysiaairlines', 'enrich'],
    program: '인리치',
    tiers: ['블루', '실버', '골드', '플래티넘'],
  },
  {
    code: 'GA',
    name: '가루다인도네시아',
    aliases: ['가루다', 'garuda'],
    program: '가루다마일즈',
    tiers: ['블루', '실버', '골드', '플래티넘'],
  },
  {
    code: 'TK',
    name: '터키항공',
    aliases: ['터키항공', '튀르키예항공', 'turkish', 'milesandsmiles'],
    program: '마일스앤스마일스',
    tiers: ['클래식', '클래식 플러스', '엘리트', '엘리트 플러스'],
  },
  {
    code: 'EY',
    name: '에티하드항공',
    aliases: ['에티하드', 'etihad'],
    program: '에티하드 게스트',
    tiers: ['브론즈', '실버', '골드', '플래티넘'],
  },
  {
    code: 'BA',
    name: '영국항공',
    aliases: ['영국항공', 'britishairways'],
    program: '브리티시 에어웨이즈 클럽',
    tiers: ['블루', '브론즈', '실버', '골드'],
  },
  {
    code: 'KL',
    name: 'KLM 네덜란드항공',
    aliases: ['klm', '네덜란드항공'],
    program: '플라잉블루',
    tiers: ['익스플로러', '실버', '골드', '플래티넘', '얼티밋'],
  },
  {
    code: 'AY',
    name: '핀에어',
    aliases: ['핀에어', 'finnair'],
    program: '핀에어 플러스',
    tiers: ['베이직', '실버', '골드', '플래티넘', '플래티넘 루모'],
  },
  {
    code: 'LX',
    name: '스위스항공',
    aliases: ['스위스항공', 'swiss'],
    program: '마일스앤모어',
    tiers: ['일반', '프리퀀트 트래블러', '세너터', 'HON 서클'],
  },
  {
    code: 'AC',
    name: '에어캐나다',
    aliases: ['에어캐나다', 'aircanada', 'aeroplan'],
    program: '에어로플랜',
    tiers: ['일반', '25K', '35K', '50K', '75K', '슈퍼 엘리트'],
  },
  {
    code: 'AS',
    name: '알래스카항공',
    aliases: ['알래스카', 'alaska', 'atmos'],
    program: '앳모스 리워즈',
    tiers: ['일반', '실버', '골드', '플래티넘', '티타늄'],
  },
  {
    code: 'HA',
    name: '하와이안항공',
    aliases: ['하와이안', 'hawaiian'],
    program: '앳모스 리워즈',
    tiers: ['일반', '실버', '골드', '플래티넘', '티타늄'],
  },
  {
    code: 'QF',
    name: '콴타스',
    aliases: ['콴타스', 'qantas'],
    program: '콴타스 프리퀀트 플라이어',
    tiers: ['브론즈', '실버', '골드', '플래티넘', '플래티넘 원'],
  },
  {
    code: 'NZ',
    name: '에어뉴질랜드',
    aliases: ['에어뉴질랜드', 'airnewzealand', 'airpoints'],
    program: '에어포인트',
    tiers: ['일반', '실버', '골드', '골드 엘리트'],
  },
  // 해외 저비용 항공사 — 우수 등급 제도 없음 → "등급 없음"
  {
    code: 'MM',
    name: '피치항공',
    aliases: ['피치', 'peach'],
    program: '피치 회원',
    tiers: [],
  },
  {
    code: 'ZG',
    name: '집에어',
    aliases: ['집에어', 'zipair'],
    program: 'ZIPAIR 회원',
    tiers: [],
  },
  {
    code: 'GK',
    name: '젯스타재팬',
    aliases: ['젯스타재팬', 'jetstarjapan'],
    program: '젯스타 회원',
    tiers: [],
  },
  {
    code: 'JQ',
    name: '젯스타',
    aliases: ['젯스타', 'jetstar'],
    program: '젯스타 회원',
    tiers: [],
  },
  {
    code: 'TR',
    name: '스쿠트',
    aliases: ['스쿠트', 'scoot'],
    program: '크리스플라이어 적립',
    tiers: [],
  },
  {
    code: 'AK',
    name: '에어아시아',
    aliases: ['에어아시아', 'airasia'],
    program: '에어아시아 무브',
    tiers: [],
  },
  {
    code: 'D7',
    name: '에어아시아X',
    aliases: ['에어아시아x', 'airasiax'],
    program: '에어아시아 무브',
    tiers: [],
  },
  {
    code: '5J',
    name: '세부퍼시픽',
    aliases: ['세부퍼시픽', 'cebupacific'],
    program: '고 리워즈',
    tiers: [],
  },
  {
    code: 'VJ',
    name: '비엣젯항공',
    aliases: ['비엣젯', 'vietjet'],
    program: '비엣젯 회원',
    tiers: [],
  },
  {
    code: '9C',
    name: '춘추항공',
    aliases: ['춘추항공', 'springairlines'],
    program: '춘추 회원',
    tiers: [],
  },
  {
    code: 'UO',
    name: '홍콩익스프레스',
    aliases: ['홍콩익스프레스', 'hkexpress'],
    program: 'HK익스프레스 회원',
    tiers: [],
  },
  {
    code: 'SL',
    name: '타이라이온에어',
    aliases: ['타이라이온', 'thailionair'],
    program: '라이온 회원',
    tiers: [],
  },
  {
    code: 'DD',
    name: '녹에어',
    aliases: ['녹에어', 'nokair'],
    program: '녹 회원',
    tiers: [],
  },
];

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 회원 항공사 이름·코드 → 프로그램 ("대한항공", "KE", "skypass" 모두) */
export function airlineProgramFor(airline: string): AirlineProgram | undefined {
  const a = norm(airline);
  if (!a) return undefined;
  return AIRLINE_PROGRAMS.find(
    (p) => norm(p.code) === a || p.aliases.some((x) => a.includes(norm(x)) || norm(x).includes(a)),
  );
}

/** 입력한 글자로 항공사 추천 (이름 앞부분 → 이름·별칭 포함 순, 최대 n개) — 회원번호 칸 오른쪽 추천 */
export function searchAirlines(q: string, n = 3): AirlineProgram[] {
  const a = norm(q);
  if (!a) return [];
  const score = (p: AirlineProgram) =>
    norm(p.name).startsWith(a) || norm(p.code) === a
      ? 0
      : norm(p.name).includes(a)
        ? 1
        : p.aliases.some((x) => norm(x).includes(a))
          ? 2
          : 9;
  return AIRLINE_PROGRAMS.map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s < 9 && norm(x.p.name) !== a)
    .sort((x, y) => x.s - y.s)
    .slice(0, n)
    .map((x) => x.p);
}
