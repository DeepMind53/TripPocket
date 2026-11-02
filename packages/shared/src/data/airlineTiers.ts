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
