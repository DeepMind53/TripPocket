/**
 * 항공사 수하물 대표값 (일반석·국제선, 사용자 요청 2026-11-02).
 * 운임·노선마다 달라서 "대표값"으로만 보여 주고, 항공사 공식 안내 링크와 확인 날짜를 함께 둔다.
 * official = 공식 페이지로 직접 확인한 값, false = 여러 여행 정보 사이트에서 일치한 값 (월간 갱신에서 공식 확인)
 */
export interface AirlineBaggage {
  code: string;
  name: string;
  aliases: readonly string[];
  /** 기내 (무게·크기·개수) */
  cabin: string;
  /** 위탁 (일반석 기본 운임 기준) */
  checked: string;
  /** 운임·노선에 따라 다른 점 */
  note?: string;
  url: string;
  official: boolean;
}

export const BAGGAGE_CHECKED_AT = '2026-11-03';

export const AIRLINE_BAGGAGE: readonly AirlineBaggage[] = [
  {
    code: 'KE',
    name: '대한항공',
    aliases: ['대한항공', 'koreanair'],
    cabin: '1개 + 개인 물품 · 합계 10kg · 세 변 합 115cm',
    checked: '1개 23kg (미주 2개) · 세 변 합 158cm',
    url: 'https://www.koreanair.com',
    official: false,
  },
  {
    code: 'OZ',
    name: '아시아나항공',
    aliases: ['아시아나', 'asiana'],
    cabin: '1개 + 개인 물품 · 합계 10kg · 세 변 합 115cm',
    checked: '1개 23kg (미주 2개) · 세 변 합 158cm',
    note: '2026-12-17 대한항공 통합 예정 — 규정이 바뀔 수 있어요',
    url: 'https://flyasiana.com',
    official: false,
  },
  {
    code: '7C',
    name: '제주항공',
    aliases: ['제주항공', 'jejuair'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '스탠다드 15kg · 비즈 라이트 30kg · 베이직 없음',
    url: 'https://www.jejuair.net/ko/linkService/boardingProcessGuide/trustBaggage.do',
    official: true,
  },
  {
    code: 'LJ',
    name: '진에어',
    aliases: ['진에어', 'jinair'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '일반 운임 15kg',
    url: 'https://www.jinair.com',
    official: false,
  },
  {
    code: 'TW',
    name: '티웨이항공',
    aliases: ['티웨이', 'tway'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '운임에 따라 15~20kg',
    note: '일부 국제선 위탁량이 바뀌었다는 소식이 있어요',
    url: 'https://www.twayair.com',
    official: false,
  },
  {
    code: 'BX',
    name: '에어부산',
    aliases: ['에어부산', 'airbusan'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '일반 운임 15kg',
    url: 'https://www.airbusan.com',
    official: false,
  },
  {
    code: 'RS',
    name: '에어서울',
    aliases: ['에어서울', 'airseoul'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '운임에 따라 15~20kg',
    url: 'https://flyairseoul.com',
    official: false,
  },
  {
    code: 'ZE',
    name: '이스타항공',
    aliases: ['이스타', 'eastar'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '일반 운임 15kg',
    url: 'https://www.eastarjet.com',
    official: false,
  },
  {
    code: 'RF',
    name: '에어로케이',
    aliases: ['에어로케이', 'aerok'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '운임에 따라 15~20kg',
    url: 'https://www.aerok.com',
    official: false,
  },
  {
    code: 'YP',
    name: '에어프레미아',
    aliases: ['에어프레미아', 'airpremia'],
    cabin: '공식 안내 확인',
    checked: '공식 안내 확인',
    url: 'https://www.airpremia.com',
    official: false,
  },
];

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 예약의 항공사 이름 또는 편명 앞 두 글자로 수하물 대표값 찾기 */
export function baggageFor(provider?: string, flightNo?: string): AirlineBaggage | undefined {
  const p = norm(provider ?? '');
  const f = norm(flightNo ?? '').slice(0, 2);
  return AIRLINE_BAGGAGE.find(
    (a) => (p && a.aliases.some((x) => p.includes(norm(x)))) || (f && norm(a.code) === f),
  );
}
