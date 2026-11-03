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
  /** 저비용 항공사 — 기내식·좌석 지정 유료 같은 공통 안내를 함께 보여 준다 */
  lcc?: boolean;
  /** 이 항공사만의 팁 (한 줄 = 한 문장, 
으로) */
  tips?: string;
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
    lcc: true,
  },
  {
    code: 'LJ',
    name: '진에어',
    aliases: ['진에어', 'jinair'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '일반 운임 15kg',
    url: 'https://www.jinair.com',
    official: false,
    lcc: true,
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
    lcc: true,
  },
  {
    code: 'BX',
    name: '에어부산',
    aliases: ['에어부산', 'airbusan'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '일반 운임 15kg',
    url: 'https://www.airbusan.com',
    official: false,
    lcc: true,
  },
  {
    code: 'RS',
    name: '에어서울',
    aliases: ['에어서울', 'airseoul'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '운임에 따라 15~20kg',
    url: 'https://flyairseoul.com',
    official: false,
    lcc: true,
  },
  {
    code: 'ZE',
    name: '이스타항공',
    aliases: ['이스타', 'eastar'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '일반 운임 15kg',
    url: 'https://www.eastarjet.com',
    official: false,
    lcc: true,
  },
  {
    code: 'RF',
    name: '에어로케이',
    aliases: ['에어로케이', 'aerok'],
    cabin: '10kg · 세 변 합 115cm',
    checked: '운임에 따라 15~20kg',
    url: 'https://www.aerok.com',
    official: false,
    lcc: true,
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
  {
    code: 'IT',
    name: '타이거에어 타이완',
    aliases: ['타이거에어', 'tigerair', '台灣虎航'],
    cabin: '기내 1개 + 개인 물품 · 합계 10kg · 54×38×23cm',
    checked: '기본 운임 없음 · 미리 구매',
    url: 'https://www.tigerairtw.com',
    official: false,
    lcc: true,
    tips: '카운터가 일찍 닫혀요\n출발 2시간 전 도착을 권해요',
  },
  {
    code: 'MM',
    name: '피치항공',
    aliases: ['피치', 'peach'],
    cabin: '2개 합계 7kg · 55×40×25cm',
    checked: '심플 피치 없음 · 상위 운임 포함',
    url: 'https://www.flypeach.com',
    official: false,
    lcc: true,
    tips: '기내 무게를 엄격하게 재요',
  },
  {
    code: 'GK',
    name: '제트스타 재팬',
    aliases: ['제트스타재팬', 'jetstarjapan'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '스타터 없음 · 번들 운임 포함',
    url: 'https://www.jetstar.com',
    official: false,
    lcc: true,
  },
  {
    code: 'JQ',
    name: '제트스타',
    aliases: ['제트스타', 'jetstar'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '스타터 없음 · 번들 운임 포함',
    url: 'https://www.jetstar.com',
    official: false,
    lcc: true,
  },
  {
    code: '3K',
    name: '제트스타 아시아',
    aliases: ['제트스타아시아', 'jetstarasia'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '스타터 없음 · 번들 운임 포함',
    url: 'https://www.jetstar.com',
    official: false,
    lcc: true,
  },
  {
    code: 'ZG',
    name: '집에어',
    aliases: ['집에어', 'zipair'],
    cabin: '2개 합계 7kg · 55×40×25cm',
    checked: '기본 운임 없음 · 미리 구매',
    url: 'https://www.zipair.net',
    official: false,
    lcc: true,
    tips: '체크인 때 기내 짐 무게를 재요',
  },
  {
    code: 'IJ',
    name: '스프링 재팬',
    aliases: ['스프링재팬', 'springjapan'],
    cabin: '2개 합계 7kg',
    checked: '기본 운임 없음 · 미리 구매',
    url: 'https://jp.ch.com',
    official: false,
    lcc: true,
  },
  {
    code: 'TR',
    name: '스쿠트',
    aliases: ['스쿠트', 'scoot'],
    cabin: '2개 합계 10kg · 54×38×23cm',
    checked: '플라이 없음 · 플라이백 20kg',
    url: 'https://www.flyscoot.com',
    official: false,
    lcc: true,
  },
  {
    code: 'VJ',
    name: '비엣젯항공',
    aliases: ['비엣젯', 'vietjet'],
    cabin: '7kg · 56×36×23cm',
    checked: '에코 없음 · 디럭스 20kg',
    url: 'https://www.vietjetair.com',
    official: false,
    lcc: true,
    tips: '기내 무게 초과면 게이트에서 부쳐요',
  },
  {
    code: 'VZ',
    name: '타이 비엣젯',
    aliases: ['타이비엣젯', 'thaivietjet'],
    cabin: '7kg · 56×36×23cm',
    checked: '에코 없음 · 디럭스 20kg',
    url: 'https://www.vietjetair.com',
    official: false,
    lcc: true,
  },
  {
    code: '5J',
    name: '세부퍼시픽',
    aliases: ['세부퍼시픽', 'cebupacific'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '고 베이직 없음 · 고 이지 20kg',
    url: 'https://www.cebupacificair.com',
    official: false,
    lcc: true,
  },
  {
    code: 'UO',
    name: '홍콩익스프레스',
    aliases: ['홍콩익스프레스', 'hkexpress'],
    cabin: '최저 운임은 개인 물품만 · 그 외 합계 7kg',
    checked: '최저 운임 없음 · 상위 운임 포함',
    url: 'https://www.hkexpress.com',
    official: false,
    lcc: true,
  },
  {
    code: 'AK',
    name: '에어아시아',
    aliases: ['에어아시아', 'airasia'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '기본 없음 · 밸류팩 20kg',
    url: 'https://www.airasia.com',
    official: false,
    lcc: true,
    tips: '기본 운임은 위탁이 없어요\n미리 사면 공항보다 싸요',
  },
  {
    code: 'D7',
    name: '에어아시아 엑스',
    aliases: ['에어아시아엑스', 'airasiax'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '기본 없음 · 밸류팩 20kg',
    url: 'https://www.airasia.com',
    official: false,
    lcc: true,
    tips: '기본 운임은 위탁이 없어요\n미리 사면 공항보다 싸요',
  },
  {
    code: 'FD',
    name: '타이 에어아시아',
    aliases: ['타이에어아시아', 'thaiairasia'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '기본 없음 · 밸류팩 20kg',
    url: 'https://www.airasia.com',
    official: false,
    lcc: true,
    tips: '기본 운임은 위탁이 없어요\n미리 사면 공항보다 싸요',
  },
  {
    code: 'Z2',
    name: '필리핀 에어아시아',
    aliases: ['필리핀에어아시아', 'philippinesairasia'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '기본 없음 · 밸류팩 20kg',
    url: 'https://www.airasia.com',
    official: false,
    lcc: true,
    tips: '기본 운임은 위탁이 없어요\n미리 사면 공항보다 싸요',
  },
  {
    code: 'QZ',
    name: '인도네시아 에어아시아',
    aliases: ['인도네시아에어아시아', 'indonesiaairasia'],
    cabin: '2개 합계 7kg · 56×36×23cm',
    checked: '기본 없음 · 밸류팩 20kg',
    url: 'https://www.airasia.com',
    official: false,
    lcc: true,
    tips: '기본 운임은 위탁이 없어요\n미리 사면 공항보다 싸요',
  },
  {
    code: 'NH',
    name: '전일본공수',
    aliases: ['전일본공수', 'allnippon'],
    cabin: '1개 + 개인 물품 · 합계 10kg · 세 변 합 115cm',
    checked: '운임에 따라 0~2개 · 1개 23kg',
    url: 'https://www.ana.co.jp',
    official: false,
  },
  {
    code: 'JL',
    name: '일본항공',
    aliases: ['일본항공', 'jal', 'japanairlines'],
    cabin: '1개 + 개인 물품 · 합계 10kg · 세 변 합 115cm',
    checked: '운임에 따라 다름 · 1개 23kg',
    url: 'https://www.jal.co.jp',
    official: false,
  },
  {
    code: 'CI',
    name: '중화항공',
    aliases: ['중화항공', 'chinaairlines'],
    cabin: '7kg · 56×36×23cm',
    checked: '한국 노선 합계 30kg (운임별 차이)',
    url: 'https://www.china-airlines.com',
    official: false,
  },
  {
    code: 'BR',
    name: '에바항공',
    aliases: ['에바항공', 'evaair'],
    cabin: '7kg · 56×36×23cm',
    checked: '한국 노선 30kg · 낮은 운임 20kg',
    url: 'https://www.evaair.com',
    official: false,
  },
  {
    code: 'VN',
    name: '베트남항공',
    aliases: ['베트남항공', 'vietnamairlines'],
    cabin: '12kg',
    checked: '1개 23kg (2026-04-29 이후 발권)',
    note: '그 전에 산 표는 2개 23kg이에요',
    url: 'https://www.vietnamairlines.com',
    official: false,
  },
  {
    code: 'SQ',
    name: '싱가포르항공',
    aliases: ['싱가포르항공', 'singaporeair'],
    cabin: '7kg · 세 변 합 115cm',
    checked: '스탠다드·플렉시 30kg · 밸류 25kg',
    url: 'https://www.singaporeair.com',
    official: false,
  },
  {
    code: 'CX',
    name: '캐세이퍼시픽',
    aliases: ['캐세이', 'cathay'],
    cabin: '7kg · 56×36×23cm',
    checked: '공식 안내 확인 (운임별 차이)',
    url: 'https://www.cathaypacific.com',
    official: false,
  },
  {
    code: 'TG',
    name: '타이항공',
    aliases: ['타이항공', 'thaiairways'],
    cabin: '7kg · 56×45×25cm',
    checked: '대표값 30kg · 운임별 차이',
    url: 'https://www.thaiairways.com',
    official: false,
  },
  {
    code: 'PR',
    name: '필리핀항공',
    aliases: ['필리핀항공', 'philippineairlines'],
    cabin: '7kg · 56×36×23cm',
    checked: '세이버 이상 30kg · 최저 운임 없음',
    url: 'https://www.philippineairlines.com',
    official: false,
  },
];

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 예약의 항공사 이름 또는 편명 앞 두 글자로 수하물 대표값 찾기 */
export function baggageFor(provider?: string, flightNo?: string): AirlineBaggage | undefined {
  const p = norm(provider ?? '');
  const f = norm(flightNo ?? '').slice(0, 2);
  const byCode = f ? AIRLINE_BAGGAGE.find((a) => norm(a.code) === f) : undefined;
  if (byCode || !p) return byCode;
  // 이름은 가장 길게 맞는 별칭으로 ("타이 에어아시아"가 "에어아시아"보다 먼저)
  let best: AirlineBaggage | undefined;
  let len = 0;
  for (const a of AIRLINE_BAGGAGE)
    for (const x of a.aliases) {
      const n = norm(x);
      if (n.length > len && p.includes(n)) [best, len] = [a, n.length];
    }
  return best;
}
