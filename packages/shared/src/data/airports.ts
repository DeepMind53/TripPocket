import { normalize } from './places';

/**
 * 공항 검색용 (항공권 입력의 출발·도착, docs/16·사용자 요청 2026-10-24).
 * 한국에서 많이 가는 공항 위주의 정적 목록 — 외부 호출 없음. 없는 공항은 IATA 코드를 직접 입력하면 된다.
 * [IATA, 한국어 이름, 영어 이름, 도시(한국어), 국가 코드]
 */
type Row = readonly [string, string, string, string, string];

const ROWS: readonly Row[] = [
  // 한국
  ['ICN', '인천국제공항', 'Incheon International', '인천', 'KR'],
  ['GMP', '김포국제공항', 'Gimpo International', '서울', 'KR'],
  ['PUS', '김해국제공항', 'Gimhae International', '부산', 'KR'],
  ['CJU', '제주국제공항', 'Jeju International', '제주', 'KR'],
  ['TAE', '대구국제공항', 'Daegu International', '대구', 'KR'],
  ['CJJ', '청주국제공항', 'Cheongju International', '청주', 'KR'],
  ['MWX', '무안국제공항', 'Muan International', '무안', 'KR'],
  ['YNY', '양양국제공항', 'Yangyang International', '양양', 'KR'],
  ['KWJ', '광주공항', 'Gwangju', '광주', 'KR'],
  ['RSU', '여수공항', 'Yeosu', '여수', 'KR'],
  ['USN', '울산공항', 'Ulsan', '울산', 'KR'],
  ['KPO', '포항경주공항', 'Pohang Gyeongju', '포항', 'KR'],
  ['HIN', '사천공항', 'Sacheon', '사천', 'KR'],
  ['WJU', '원주공항', 'Wonju', '원주', 'KR'],
  ['KUV', '군산공항', 'Gunsan', '군산', 'KR'],
  // 일본
  ['NRT', '나리타국제공항', 'Narita International', '도쿄', 'JP'],
  ['HND', '하네다공항', 'Haneda', '도쿄', 'JP'],
  ['KIX', '간사이국제공항', 'Kansai International', '오사카', 'JP'],
  ['ITM', '이타미공항', 'Itami (Osaka International)', '오사카', 'JP'],
  ['FUK', '후쿠오카공항', 'Fukuoka', '후쿠오카', 'JP'],
  ['CTS', '신치토세공항', 'New Chitose', '삿포로', 'JP'],
  ['OKA', '나하공항', 'Naha', '오키나와', 'JP'],
  ['NGO', '주부국제공항', 'Chubu Centrair International', '나고야', 'JP'],
  ['KOJ', '가고시마공항', 'Kagoshima', '가고시마', 'JP'],
  ['KMJ', '구마모토공항', 'Kumamoto', '구마모토', 'JP'],
  ['OIT', '오이타공항', 'Oita', '오이타', 'JP'],
  ['KKJ', '기타큐슈공항', 'Kitakyushu', '기타큐슈', 'JP'],
  ['NGS', '나가사키공항', 'Nagasaki', '나가사키', 'JP'],
  ['HIJ', '히로시마공항', 'Hiroshima', '히로시마', 'JP'],
  ['OKJ', '오카야마공항', 'Okayama', '오카야마', 'JP'],
  ['TAK', '다카마쓰공항', 'Takamatsu', '다카마쓰', 'JP'],
  ['MYJ', '마쓰야마공항', 'Matsuyama', '마쓰야마', 'JP'],
  ['SDJ', '센다이공항', 'Sendai', '센다이', 'JP'],
  ['KIJ', '니가타공항', 'Niigata', '니가타', 'JP'],
  ['KMQ', '고마쓰공항', 'Komatsu', '가나자와', 'JP'],
  ['TOY', '도야마공항', 'Toyama', '도야마', 'JP'],
  ['FSZ', '시즈오카공항', 'Shizuoka', '시즈오카', 'JP'],
  ['UBJ', '야마구치우베공항', 'Yamaguchi Ube', '우베', 'JP'],
  ['YGJ', '요나고공항', 'Yonago', '요나고', 'JP'],
  ['AOJ', '아오모리공항', 'Aomori', '아오모리', 'JP'],
  ['ISG', '이시가키공항', 'Ishigaki', '이시가키', 'JP'],
  ['MMY', '미야코공항', 'Miyako', '미야코지마', 'JP'],
  ['SHI', '시모지시마공항', 'Shimojishima', '미야코지마', 'JP'],
  ['AKJ', '아사히카와공항', 'Asahikawa', '아사히카와', 'JP'],
  ['HKD', '하코다테공항', 'Hakodate', '하코다테', 'JP'],
  // 중화권
  ['TPE', '타오위안국제공항', 'Taoyuan International', '타이베이', 'TW'],
  ['TSA', '쑹산공항', 'Songshan', '타이베이', 'TW'],
  ['KHH', '가오슝국제공항', 'Kaohsiung International', '가오슝', 'TW'],
  ['RMQ', '타이중국제공항', 'Taichung International', '타이중', 'TW'],
  ['HKG', '홍콩국제공항', 'Hong Kong International', '홍콩', 'HK'],
  ['MFM', '마카오국제공항', 'Macau International', '마카오', 'MO'],
  ['PEK', '베이징서우두국제공항', 'Beijing Capital International', '베이징', 'CN'],
  ['PKX', '베이징다싱국제공항', 'Beijing Daxing International', '베이징', 'CN'],
  ['PVG', '상하이푸둥국제공항', 'Shanghai Pudong International', '상하이', 'CN'],
  ['SHA', '상하이훙차오국제공항', 'Shanghai Hongqiao International', '상하이', 'CN'],
  ['CAN', '광저우바이윈국제공항', 'Guangzhou Baiyun International', '광저우', 'CN'],
  ['SZX', '선전바오안국제공항', "Shenzhen Bao'an International", '선전', 'CN'],
  ['TAO', '칭다오자오둥국제공항', 'Qingdao Jiaodong International', '칭다오', 'CN'],
  ['DLC', '다롄저우수이쯔국제공항', 'Dalian Zhoushuizi International', '다롄', 'CN'],
  ['SHE', '선양타오셴국제공항', 'Shenyang Taoxian International', '선양', 'CN'],
  ['YNJ', '옌지차오양촨국제공항', 'Yanji Chaoyangchuan International', '옌지', 'CN'],
  ['CTU', '청두톈푸국제공항', 'Chengdu Tianfu International', '청두', 'CN'],
  ['XIY', '시안셴양국제공항', "Xi'an Xianyang International", '시안', 'CN'],
  ['HGH', '항저우샤오산국제공항', 'Hangzhou Xiaoshan International', '항저우', 'CN'],
  ['CKG', '충칭장베이국제공항', 'Chongqing Jiangbei International', '충칭', 'CN'],
  ['KMG', '쿤밍창수이국제공항', 'Kunming Changshui International', '쿤밍', 'CN'],
  ['SYX', '싼야펑황국제공항', 'Sanya Phoenix International', '싼야', 'CN'],
  ['DYG', '장자제허화국제공항', 'Zhangjiajie Hehua International', '장자제', 'CN'],
  // 동남아
  ['BKK', '수완나품국제공항', 'Suvarnabhumi', '방콕', 'TH'],
  ['DMK', '돈므앙국제공항', 'Don Mueang International', '방콕', 'TH'],
  ['HKT', '푸껫국제공항', 'Phuket International', '푸껫', 'TH'],
  ['CNX', '치앙마이국제공항', 'Chiang Mai International', '치앙마이', 'TH'],
  ['USM', '사무이공항', 'Samui', '코사무이', 'TH'],
  ['KBV', '끄라비국제공항', 'Krabi International', '끄라비', 'TH'],
  ['SGN', '떤선녓국제공항', 'Tan Son Nhat International', '호찌민', 'VN'],
  ['HAN', '노이바이국제공항', 'Noi Bai International', '하노이', 'VN'],
  ['DAD', '다낭국제공항', 'Da Nang International', '다낭', 'VN'],
  ['CXR', '깜라인국제공항', 'Cam Ranh International', '나트랑', 'VN'],
  ['PQC', '푸꾸옥국제공항', 'Phu Quoc International', '푸꾸옥', 'VN'],
  ['DLI', '리엔크엉공항', 'Lien Khuong', '달랏', 'VN'],
  ['HPH', '깟비국제공항', 'Cat Bi International', '하이퐁', 'VN'],
  ['MNL', '니노이아키노국제공항', 'Ninoy Aquino International', '마닐라', 'PH'],
  ['CEB', '막탄세부국제공항', 'Mactan-Cebu International', '세부', 'PH'],
  ['CRK', '클라크국제공항', 'Clark International', '클라크', 'PH'],
  ['MPH', '카티클란공항', 'Godofredo P. Ramos (Caticlan)', '보라카이', 'PH'],
  ['TAG', '보홀팡라오국제공항', 'Bohol-Panglao International', '보홀', 'PH'],
  ['PPS', '푸에르토프린세사국제공항', 'Puerto Princesa International', '팔라완', 'PH'],
  ['SIN', '창이공항', 'Changi', '싱가포르', 'SG'],
  ['KUL', '쿠알라룸푸르국제공항', 'Kuala Lumpur International', '쿠알라룸푸르', 'MY'],
  ['BKI', '코타키나발루국제공항', 'Kota Kinabalu International', '코타키나발루', 'MY'],
  ['PEN', '페낭국제공항', 'Penang International', '페낭', 'MY'],
  ['LGK', '랑카위국제공항', 'Langkawi International', '랑카위', 'MY'],
  ['CGK', '수카르노하타국제공항', 'Soekarno-Hatta International', '자카르타', 'ID'],
  ['DPS', '응우라라이국제공항', 'Ngurah Rai International', '발리', 'ID'],
  ['BTH', '항나딤국제공항', 'Hang Nadim International', '바탐', 'ID'],
  ['PNH', '테초국제공항', 'Techo International', '프놈펜', 'KH'],
  ['SAI', '시엠레아프앙코르국제공항', 'Siem Reap-Angkor International', '시엠레아프', 'KH'],
  ['VTE', '왓따이국제공항', 'Wattay International', '비엔티안', 'LA'],
  ['LPQ', '루앙프라방국제공항', 'Luang Prabang International', '루앙프라방', 'LA'],
  ['RGN', '양곤국제공항', 'Yangon International', '양곤', 'MM'],
  ['BWN', '브루나이국제공항', 'Brunei International', '반다르스리브가완', 'BN'],
  // 기타 아시아
  ['ULN', '칭기스칸국제공항', 'Chinggis Khaan International', '울란바토르', 'MN'],
  ['DEL', '인디라간디국제공항', 'Indira Gandhi International', '델리', 'IN'],
  ['BOM', '차트라파티시바지국제공항', 'Chhatrapati Shivaji Maharaj International', '뭄바이', 'IN'],
  ['KTM', '트리부반국제공항', 'Tribhuvan International', '카트만두', 'NP'],
  ['CMB', '반다라나이케국제공항', 'Bandaranaike International', '콜롬보', 'LK'],
  ['MLE', '벨라나국제공항', 'Velana International', '말레', 'MV'],
  ['TAS', '타슈켄트국제공항', 'Tashkent International', '타슈켄트', 'UZ'],
  ['ALA', '알마티국제공항', 'Almaty International', '알마티', 'KZ'],
  ['VVO', '블라디보스토크국제공항', 'Vladivostok International', '블라디보스토크', 'RU'],
  // 중동
  ['DXB', '두바이국제공항', 'Dubai International', '두바이', 'AE'],
  ['AUH', '자이드국제공항', 'Zayed International', '아부다비', 'AE'],
  ['DOH', '하마드국제공항', 'Hamad International', '도하', 'QA'],
  ['IST', '이스탄불공항', 'Istanbul', '이스탄불', 'TR'],
  ['SAW', '사비하괵첸국제공항', 'Sabiha Gökçen International', '이스탄불', 'TR'],
  ['TLV', '벤구리온국제공항', 'Ben Gurion', '텔아비브', 'IL'],
  ['CAI', '카이로국제공항', 'Cairo International', '카이로', 'EG'],
  // 오세아니아·태평양
  ['GUM', '괌국제공항', 'Antonio B. Won Pat International', '괌', 'GU'],
  ['SPN', '사이판국제공항', 'Saipan International', '사이판', 'MP'],
  ['ROR', '팔라우국제공항', 'Roman Tmetuchl International', '팔라우', 'PW'],
  ['HNL', '대니얼K.이노우에국제공항', 'Daniel K. Inouye International', '호놀룰루', 'US'],
  ['SYD', '시드니공항', 'Sydney Kingsford Smith', '시드니', 'AU'],
  ['MEL', '멜버른공항', 'Melbourne', '멜버른', 'AU'],
  ['BNE', '브리즈번공항', 'Brisbane', '브리즈번', 'AU'],
  ['PER', '퍼스공항', 'Perth', '퍼스', 'AU'],
  ['OOL', '골드코스트공항', 'Gold Coast', '골드코스트', 'AU'],
  ['CNS', '케언스공항', 'Cairns', '케언스', 'AU'],
  ['AKL', '오클랜드공항', 'Auckland', '오클랜드', 'NZ'],
  ['CHC', '크라이스트처치공항', 'Christchurch', '크라이스트처치', 'NZ'],
  ['ZQN', '퀸스타운공항', 'Queenstown', '퀸스타운', 'NZ'],
  ['NAN', '난디국제공항', 'Nadi International', '난디', 'FJ'],
  // 북미
  ['LAX', '로스앤젤레스국제공항', 'Los Angeles International', '로스앤젤레스', 'US'],
  ['SFO', '샌프란시스코국제공항', 'San Francisco International', '샌프란시스코', 'US'],
  ['SEA', '시애틀터코마국제공항', 'Seattle-Tacoma International', '시애틀', 'US'],
  ['LAS', '해리리드국제공항', 'Harry Reid International', '라스베이거스', 'US'],
  ['JFK', 'JFK국제공항', 'John F. Kennedy International', '뉴욕', 'US'],
  ['EWR', '뉴어크리버티국제공항', 'Newark Liberty International', '뉴욕', 'US'],
  ['LGA', '라과디아공항', 'LaGuardia', '뉴욕', 'US'],
  ['ORD', '오헤어국제공항', "O'Hare International", '시카고', 'US'],
  [
    'ATL',
    '하츠필드잭슨애틀랜타국제공항',
    'Hartsfield-Jackson Atlanta International',
    '애틀랜타',
    'US',
  ],
  ['DFW', '댈러스포트워스국제공항', 'Dallas/Fort Worth International', '댈러스', 'US'],
  ['IAD', '덜레스국제공항', 'Washington Dulles International', '워싱턴 D.C.', 'US'],
  ['BOS', '로건국제공항', 'Logan International', '보스턴', 'US'],
  ['MIA', '마이애미국제공항', 'Miami International', '마이애미', 'US'],
  ['MCO', '올랜도국제공항', 'Orlando International', '올랜도', 'US'],
  ['DEN', '덴버국제공항', 'Denver International', '덴버', 'US'],
  ['IAH', '조지부시인터컨티넨털공항', 'George Bush Intercontinental', '휴스턴', 'US'],
  ['ANC', '테드스티븐스앵커리지국제공항', 'Ted Stevens Anchorage International', '앵커리지', 'US'],
  ['YVR', '밴쿠버국제공항', 'Vancouver International', '밴쿠버', 'CA'],
  ['YYZ', '토론토피어슨국제공항', 'Toronto Pearson International', '토론토', 'CA'],
  ['YUL', '몬트리올트뤼도국제공항', 'Montréal-Trudeau International', '몬트리올', 'CA'],
  ['YYC', '캘거리국제공항', 'Calgary International', '캘거리', 'CA'],
  ['MEX', '멕시코시티국제공항', 'Mexico City International', '멕시코시티', 'MX'],
  ['CUN', '칸쿤국제공항', 'Cancún International', '칸쿤', 'MX'],
  // 유럽
  ['LHR', '히스로공항', 'Heathrow', '런던', 'GB'],
  ['LGW', '개트윅공항', 'Gatwick', '런던', 'GB'],
  ['CDG', '샤를드골공항', 'Charles de Gaulle', '파리', 'FR'],
  ['ORY', '오를리공항', 'Orly', '파리', 'FR'],
  ['NCE', '니스코트다쥐르공항', "Nice Côte d'Azur", '니스', 'FR'],
  ['FRA', '프랑크푸르트공항', 'Frankfurt', '프랑크푸르트', 'DE'],
  ['MUC', '뮌헨공항', 'Munich', '뮌헨', 'DE'],
  ['BER', '베를린브란덴부르크공항', 'Berlin Brandenburg', '베를린', 'DE'],
  ['AMS', '스히폴공항', 'Schiphol', '암스테르담', 'NL'],
  ['FCO', '피우미치노공항', 'Fiumicino', '로마', 'IT'],
  ['MXP', '말펜사공항', 'Malpensa', '밀라노', 'IT'],
  ['VCE', '마르코폴로공항', 'Marco Polo', '베네치아', 'IT'],
  ['NAP', '나폴리공항', 'Naples', '나폴리', 'IT'],
  ['FLR', '피렌체공항', 'Florence', '피렌체', 'IT'],
  ['MAD', '바라하스공항', 'Adolfo Suárez Madrid-Barajas', '마드리드', 'ES'],
  ['BCN', '엘프라트공항', 'Barcelona-El Prat', '바르셀로나', 'ES'],
  ['LIS', '리스본공항', 'Lisbon Humberto Delgado', '리스본', 'PT'],
  ['ZRH', '취리히공항', 'Zurich', '취리히', 'CH'],
  ['GVA', '제네바공항', 'Geneva', '제네바', 'CH'],
  ['VIE', '빈국제공항', 'Vienna International', '빈', 'AT'],
  ['PRG', '바츨라프하벨공항', 'Václav Havel Prague', '프라하', 'CZ'],
  ['BUD', '부다페스트공항', 'Budapest Ferenc Liszt International', '부다페스트', 'HU'],
  ['WAW', '쇼팽공항', 'Warsaw Chopin', '바르샤바', 'PL'],
  ['CPH', '코펜하겐공항', 'Copenhagen', '코펜하겐', 'DK'],
  ['HEL', '헬싱키반타공항', 'Helsinki-Vantaa', '헬싱키', 'FI'],
  ['ARN', '알란다공항', 'Stockholm Arlanda', '스톡홀름', 'SE'],
  ['OSL', '오슬로공항', 'Oslo Gardermoen', '오슬로', 'NO'],
  ['KEF', '케플라비크국제공항', 'Keflavík International', '레이캬비크', 'IS'],
  ['DUB', '더블린공항', 'Dublin', '더블린', 'IE'],
  ['BRU', '브뤼셀공항', 'Brussels', '브뤼셀', 'BE'],
  ['ATH', '아테네국제공항', 'Athens International', '아테네', 'GR'],
  ['ZAG', '자그레브공항', 'Zagreb Franjo Tuđman', '자그레브', 'HR'],
  ['DBV', '두브로브니크공항', 'Dubrovnik', '두브로브니크', 'HR'],
  ['SPU', '스플리트공항', 'Split', '스플리트', 'HR'],
];

export interface Airport {
  iata: string;
  name: string;
  nameEn: string;
  city: string;
  countryCode: string;
}

const AIRPORTS: readonly Airport[] = ROWS.map(([iata, name, nameEn, city, countryCode]) => ({
  iata,
  name,
  nameEn,
  city,
  countryCode,
}));

export const findAirport = (iata: string): Airport | undefined =>
  AIRPORTS.find((a) => a.iata === iata.trim().toUpperCase());

/**
 * 공항 찾기: IATA 코드(정확히 맞으면 맨 앞) > 공항 이름 > 도시 이름 > 영어 이름.
 * "도쿄" → 나리타·하네다, "nrt" → 나리타, "간사이" → 간사이
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = normalize(query);
  if (!q) return [];
  const code = query.trim().toUpperCase();
  const score = (a: Airport): number => {
    if (a.iata === code) return 0;
    if (normalize(a.name).startsWith(q)) return 1;
    if (normalize(a.city).startsWith(q)) return 2;
    if (a.iata.startsWith(code) && code.length >= 2) return 3;
    if (normalize(a.name).includes(q) || normalize(a.city).includes(q)) return 4;
    if (normalize(a.nameEn).includes(q)) return 5;
    return 9;
  };
  return AIRPORTS.map((a) => [a, score(a)] as const)
    .filter(([, s]) => s < 9)
    .sort((x, y) => x[1] - y[1])
    .slice(0, limit)
    .map(([a]) => a);
}
