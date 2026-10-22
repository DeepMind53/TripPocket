/**
 * 도시·국가 검색 데이터 (외부 API 없이 무료·오프라인).
 * 행 = [한글 이름, 영어 이름, 국가 코드(ISO 3166-1), IANA 시간대, 위도, 경도, 별칭(| 구분)?]
 * - 같은 나라는 맨 처음 나온 도시가 대표(국가를 고르면 그 도시의 시간대·좌표를 쓴다).
 * - 순서 = 인기순(검색 점수가 같으면 앞쪽이 먼저).
 * - 국가 이름은 브라우저 내장 Intl.DisplayNames로 한글·영어를 만든다 (데이터 0바이트).
 */
import { ASIA_ROWS, type PlaceRow } from './placesAsia';
import { GEN_ALIASES, GEN_PLACES } from './placesGen';
import { AIRPORT_ALIASES, TRAVEL_ROWS } from './placesTravel';

type Row = PlaceRow;

const ROWS: Row[] = [
  // 대한민국
  [
    '서울',
    'Seoul',
    'KR',
    'Asia/Seoul',
    37.57,
    126.98,
    '강남|홍대|명동|이태원|성수|잠실|여의도|종로|인사동|북촌',
  ],
  ['부산', 'Busan', 'KR', 'Asia/Seoul', 35.18, 129.08, '해운대|광안리|서면|남포동|기장|송정|Pusan'],
  ['제주', 'Jeju', 'KR', 'Asia/Seoul', 33.5, 126.53, '제주도|Jeju Island|애월|협재|함덕|한림'],
  ['서귀포', 'Seogwipo', 'KR', 'Asia/Seoul', 33.25, 126.56, '중문|성산|성산일출봉|표선'],
  ['강릉', 'Gangneung', 'KR', 'Asia/Seoul', 37.75, 128.88],
  ['경주', 'Gyeongju', 'KR', 'Asia/Seoul', 35.86, 129.22],
  ['여수', 'Yeosu', 'KR', 'Asia/Seoul', 34.76, 127.66],
  ['전주', 'Jeonju', 'KR', 'Asia/Seoul', 35.82, 127.15],
  ['속초', 'Sokcho', 'KR', 'Asia/Seoul', 38.21, 128.59],
  ['인천', 'Incheon', 'KR', 'Asia/Seoul', 37.46, 126.71, '인천공항|영종도|송도|월미도'],
  ['대구', 'Daegu', 'KR', 'Asia/Seoul', 35.87, 128.6],
  ['대전', 'Daejeon', 'KR', 'Asia/Seoul', 36.35, 127.38],
  ['광주', 'Gwangju', 'KR', 'Asia/Seoul', 35.16, 126.85],
  ['울산', 'Ulsan', 'KR', 'Asia/Seoul', 35.54, 129.31],
  ['수원', 'Suwon', 'KR', 'Asia/Seoul', 37.26, 127.03],
  ['양양', 'Yangyang', 'KR', 'Asia/Seoul', 38.08, 128.62],
  ['춘천', 'Chuncheon', 'KR', 'Asia/Seoul', 37.88, 127.73],
  ['평창', 'Pyeongchang', 'KR', 'Asia/Seoul', 37.37, 128.39],
  ['가평', 'Gapyeong', 'KR', 'Asia/Seoul', 37.83, 127.51],
  ['안동', 'Andong', 'KR', 'Asia/Seoul', 36.57, 128.73],
  ['포항', 'Pohang', 'KR', 'Asia/Seoul', 36.02, 129.34],
  ['통영', 'Tongyeong', 'KR', 'Asia/Seoul', 34.85, 128.43],
  ['거제', 'Geoje', 'KR', 'Asia/Seoul', 34.88, 128.62],
  ['남해', 'Namhae', 'KR', 'Asia/Seoul', 34.84, 127.89],
  ['순천', 'Suncheon', 'KR', 'Asia/Seoul', 34.95, 127.49],
  ['목포', 'Mokpo', 'KR', 'Asia/Seoul', 34.81, 126.39],
  ['군산', 'Gunsan', 'KR', 'Asia/Seoul', 35.97, 126.74],
  ['담양', 'Damyang', 'KR', 'Asia/Seoul', 35.32, 126.99],
  ['단양', 'Danyang', 'KR', 'Asia/Seoul', 36.98, 128.37],
  ['태안', 'Taean', 'KR', 'Asia/Seoul', 36.75, 126.3],
  ['울릉도', 'Ulleungdo', 'KR', 'Asia/Seoul', 37.48, 130.9, '울릉'],
  // 일본
  [
    '도쿄',
    'Tokyo',
    'JP',
    'Asia/Tokyo',
    35.68,
    139.69,
    '동경|토쿄|신주쿠|시부야|긴자|아사쿠사|이케부쿠로|오다이바',
  ],
  [
    '오사카',
    'Osaka',
    'JP',
    'Asia/Tokyo',
    34.69,
    135.5,
    '난바|우메다|도톤보리|신사이바시|유니버설|USJ',
  ],
  ['후쿠오카', 'Fukuoka', 'JP', 'Asia/Tokyo', 33.59, 130.4, '하카타|Hakata|텐진|다자이후'],
  ['교토', 'Kyoto', 'JP', 'Asia/Tokyo', 35.01, 135.77, '아라시야마|기온|후시미이나리'],
  ['삿포로', 'Sapporo', 'JP', 'Asia/Tokyo', 43.06, 141.35, '홋카이도|Hokkaido'],
  ['오키나와', 'Okinawa', 'JP', 'Asia/Tokyo', 26.21, 127.68, '나하|Naha'],
  ['나라', 'Nara', 'JP', 'Asia/Tokyo', 34.69, 135.8],
  ['고베', 'Kobe', 'JP', 'Asia/Tokyo', 34.69, 135.2],
  ['요코하마', 'Yokohama', 'JP', 'Asia/Tokyo', 35.44, 139.64],
  ['나고야', 'Nagoya', 'JP', 'Asia/Tokyo', 35.18, 136.91],
  ['하코네', 'Hakone', 'JP', 'Asia/Tokyo', 35.23, 139.11],
  ['가마쿠라', 'Kamakura', 'JP', 'Asia/Tokyo', 35.32, 139.55],
  ['닛코', 'Nikko', 'JP', 'Asia/Tokyo', 36.72, 139.7],
  ['가나자와', 'Kanazawa', 'JP', 'Asia/Tokyo', 36.56, 136.66],
  ['히로시마', 'Hiroshima', 'JP', 'Asia/Tokyo', 34.39, 132.46],
  ['나가사키', 'Nagasaki', 'JP', 'Asia/Tokyo', 32.75, 129.88],
  ['구마모토', 'Kumamoto', 'JP', 'Asia/Tokyo', 32.8, 130.71],
  ['가고시마', 'Kagoshima', 'JP', 'Asia/Tokyo', 31.6, 130.56],
  ['벳푸', 'Beppu', 'JP', 'Asia/Tokyo', 33.28, 131.49],
  ['유후인', 'Yufuin', 'JP', 'Asia/Tokyo', 33.27, 131.37, '유후'],
  ['오타루', 'Otaru', 'JP', 'Asia/Tokyo', 43.19, 141.0],
  ['하코다테', 'Hakodate', 'JP', 'Asia/Tokyo', 41.77, 140.73],
  ['센다이', 'Sendai', 'JP', 'Asia/Tokyo', 38.27, 140.87],
  ['다카마쓰', 'Takamatsu', 'JP', 'Asia/Tokyo', 34.34, 134.05, '다카마츠'],
  ['마쓰야마', 'Matsuyama', 'JP', 'Asia/Tokyo', 33.84, 132.77, '마츠야마'],
  ['시즈오카', 'Shizuoka', 'JP', 'Asia/Tokyo', 34.98, 138.38],
  ['기타큐슈', 'Kitakyushu', 'JP', 'Asia/Tokyo', 33.88, 130.88],
  ['미야코지마', 'Miyakojima', 'JP', 'Asia/Tokyo', 24.8, 125.28],
  // 중화권·몽골
  ['타이베이', 'Taipei', 'TW', 'Asia/Taipei', 25.03, 121.57, '타이페이|대북'],
  ['가오슝', 'Kaohsiung', 'TW', 'Asia/Taipei', 22.63, 120.3],
  ['타이중', 'Taichung', 'TW', 'Asia/Taipei', 24.15, 120.67],
  ['화롄', 'Hualien', 'TW', 'Asia/Taipei', 23.99, 121.6, '화련|타이루거|Taroko'],
  ['홍콩', 'Hong Kong', 'HK', 'Asia/Hong_Kong', 22.32, 114.17],
  ['마카오', 'Macau', 'MO', 'Asia/Macau', 22.2, 113.54, 'Macao'],
  [
    '상하이',
    'Shanghai',
    'CN',
    'Asia/Shanghai',
    31.23,
    121.47,
    '상해|와이탄|푸동|디즈니랜드 상하이',
  ],
  ['베이징', 'Beijing', 'CN', 'Asia/Shanghai', 39.9, 116.41, '북경|Peking|만리장성|자금성'],
  ['칭다오', 'Qingdao', 'CN', 'Asia/Shanghai', 36.07, 120.38, '청도'],
  ['청두', 'Chengdu', 'CN', 'Asia/Shanghai', 30.57, 104.07, '성도'],
  ['시안', "Xi'an", 'CN', 'Asia/Shanghai', 34.34, 108.94, '서안|Xian'],
  ['장자제', 'Zhangjiajie', 'CN', 'Asia/Shanghai', 29.12, 110.48, '장가계'],
  ['광저우', 'Guangzhou', 'CN', 'Asia/Shanghai', 23.13, 113.26, '광주(중국)'],
  ['선전', 'Shenzhen', 'CN', 'Asia/Shanghai', 22.54, 114.06, '심천'],
  ['싼야', 'Sanya', 'CN', 'Asia/Shanghai', 18.25, 109.51, '하이난|Hainan|삼아'],
  ['다롄', 'Dalian', 'CN', 'Asia/Shanghai', 38.91, 121.61, '대련'],
  ['하얼빈', 'Harbin', 'CN', 'Asia/Shanghai', 45.8, 126.53],
  ['구이린', 'Guilin', 'CN', 'Asia/Shanghai', 25.27, 110.29, '계림'],
  ['울란바토르', 'Ulaanbaatar', 'MN', 'Asia/Ulaanbaatar', 47.89, 106.91, '몽골'],
  // 동남아시아
  ['방콕', 'Bangkok', 'TH', 'Asia/Bangkok', 13.76, 100.5],
  ['치앙마이', 'Chiang Mai', 'TH', 'Asia/Bangkok', 18.79, 98.98],
  ['푸껫', 'Phuket', 'TH', 'Asia/Bangkok', 7.88, 98.39, '푸켓'],
  ['파타야', 'Pattaya', 'TH', 'Asia/Bangkok', 12.93, 100.88],
  ['끄라비', 'Krabi', 'TH', 'Asia/Bangkok', 8.09, 98.91, '크라비'],
  ['코사무이', 'Koh Samui', 'TH', 'Asia/Bangkok', 9.51, 100.01, '사무이'],
  ['다낭', 'Da Nang', 'VN', 'Asia/Ho_Chi_Minh', 16.05, 108.2, 'Danang'],
  ['나트랑', 'Nha Trang', 'VN', 'Asia/Ho_Chi_Minh', 12.24, 109.19, '냐짱|나짱'],
  ['호치민', 'Ho Chi Minh City', 'VN', 'Asia/Ho_Chi_Minh', 10.82, 106.63, '호찌민|사이공|Saigon'],
  ['하노이', 'Hanoi', 'VN', 'Asia/Ho_Chi_Minh', 21.03, 105.85],
  ['푸꾸옥', 'Phu Quoc', 'VN', 'Asia/Ho_Chi_Minh', 10.29, 103.98, '푸쿠옥'],
  ['호이안', 'Hoi An', 'VN', 'Asia/Ho_Chi_Minh', 15.88, 108.33],
  ['달랏', 'Da Lat', 'VN', 'Asia/Ho_Chi_Minh', 11.94, 108.44, 'Dalat'],
  ['하롱베이', 'Ha Long', 'VN', 'Asia/Ho_Chi_Minh', 20.95, 107.08, '하롱|Halong Bay'],
  ['사파', 'Sapa', 'VN', 'Asia/Ho_Chi_Minh', 22.34, 103.84],
  ['싱가포르', 'Singapore', 'SG', 'Asia/Singapore', 1.35, 103.82, '싱가폴'],
  ['쿠알라룸푸르', 'Kuala Lumpur', 'MY', 'Asia/Kuala_Lumpur', 3.14, 101.69, 'KL'],
  ['코타키나발루', 'Kota Kinabalu', 'MY', 'Asia/Kuching', 5.98, 116.07, '코타'],
  ['페낭', 'Penang', 'MY', 'Asia/Kuala_Lumpur', 5.41, 100.33],
  ['랑카위', 'Langkawi', 'MY', 'Asia/Kuala_Lumpur', 6.35, 99.8],
  ['발리', 'Bali', 'ID', 'Asia/Makassar', -8.41, 115.19, '덴파사르|우붓|Ubud|Denpasar'],
  ['자카르타', 'Jakarta', 'ID', 'Asia/Jakarta', -6.21, 106.85],
  ['세부', 'Cebu', 'PH', 'Asia/Manila', 10.32, 123.89, '막탄'],
  ['보라카이', 'Boracay', 'PH', 'Asia/Manila', 11.97, 121.92],
  ['보홀', 'Bohol', 'PH', 'Asia/Manila', 9.85, 124.14],
  ['마닐라', 'Manila', 'PH', 'Asia/Manila', 14.6, 120.98],
  ['팔라완', 'Palawan', 'PH', 'Asia/Manila', 9.84, 118.74, '엘니도|El Nido|코론'],
  ['클락', 'Clark', 'PH', 'Asia/Manila', 15.18, 120.56, '앙헬레스'],
  ['씨엠립', 'Siem Reap', 'KH', 'Asia/Phnom_Penh', 13.36, 103.86, '시엠립|앙코르와트|Angkor Wat'],
  ['프놈펜', 'Phnom Penh', 'KH', 'Asia/Phnom_Penh', 11.56, 104.93],
  ['비엔티안', 'Vientiane', 'LA', 'Asia/Vientiane', 17.98, 102.63, '위앙짠'],
  ['루앙프라방', 'Luang Prabang', 'LA', 'Asia/Vientiane', 19.89, 102.13],
  ['방비엥', 'Vang Vieng', 'LA', 'Asia/Vientiane', 18.92, 102.45],
  ['양곤', 'Yangon', 'MM', 'Asia/Yangon', 16.84, 96.17],
  // 남아시아·중동·중앙아시아
  ['몰디브', 'Maldives', 'MV', 'Indian/Maldives', 3.2, 73.22, '말레|Male'],
  ['델리', 'Delhi', 'IN', 'Asia/Kolkata', 28.61, 77.21, '뉴델리|New Delhi'],
  ['뭄바이', 'Mumbai', 'IN', 'Asia/Kolkata', 19.08, 72.88, '봄베이'],
  ['카트만두', 'Kathmandu', 'NP', 'Asia/Kathmandu', 27.72, 85.32],
  ['콜롬보', 'Colombo', 'LK', 'Asia/Colombo', 6.93, 79.86],
  ['두바이', 'Dubai', 'AE', 'Asia/Dubai', 25.2, 55.27],
  ['아부다비', 'Abu Dhabi', 'AE', 'Asia/Dubai', 24.45, 54.38],
  ['도하', 'Doha', 'QA', 'Asia/Qatar', 25.29, 51.53],
  ['이스탄불', 'Istanbul', 'TR', 'Europe/Istanbul', 41.01, 28.98],
  ['카파도키아', 'Cappadocia', 'TR', 'Europe/Istanbul', 38.64, 34.83, '괴레메|Goreme'],
  ['안탈리아', 'Antalya', 'TR', 'Europe/Istanbul', 36.9, 30.71],
  ['예루살렘', 'Jerusalem', 'IL', 'Asia/Jerusalem', 31.77, 35.21],
  ['암만', 'Amman', 'JO', 'Asia/Amman', 31.95, 35.93],
  ['페트라', 'Petra', 'JO', 'Asia/Amman', 30.33, 35.44],
  ['알마티', 'Almaty', 'KZ', 'Asia/Almaty', 43.24, 76.89],
  ['타슈켄트', 'Tashkent', 'UZ', 'Asia/Tashkent', 41.3, 69.24],
  ['사마르칸트', 'Samarkand', 'UZ', 'Asia/Samarkand', 39.65, 66.96],
  // 유럽
  ['파리', 'Paris', 'FR', 'Europe/Paris', 48.86, 2.35],
  ['니스', 'Nice', 'FR', 'Europe/Paris', 43.7, 7.27, '니스(프랑스)'],
  ['마르세유', 'Marseille', 'FR', 'Europe/Paris', 43.3, 5.37],
  ['리옹', 'Lyon', 'FR', 'Europe/Paris', 45.76, 4.84],
  ['몽생미셸', 'Mont-Saint-Michel', 'FR', 'Europe/Paris', 48.64, -1.51],
  ['스트라스부르', 'Strasbourg', 'FR', 'Europe/Paris', 48.57, 7.75],
  ['런던', 'London', 'GB', 'Europe/London', 51.51, -0.13, '영국'],
  ['에든버러', 'Edinburgh', 'GB', 'Europe/London', 55.95, -3.19, '에딘버러'],
  ['맨체스터', 'Manchester', 'GB', 'Europe/London', 53.48, -2.24],
  ['리버풀', 'Liverpool', 'GB', 'Europe/London', 53.41, -2.98],
  ['더블린', 'Dublin', 'IE', 'Europe/Dublin', 53.35, -6.26],
  ['로마', 'Rome', 'IT', 'Europe/Rome', 41.9, 12.5, 'Roma'],
  ['피렌체', 'Florence', 'IT', 'Europe/Rome', 43.77, 11.26, 'Firenze|플로렌스'],
  ['베네치아', 'Venice', 'IT', 'Europe/Rome', 45.44, 12.33, '베니스|Venezia'],
  ['밀라노', 'Milan', 'IT', 'Europe/Rome', 45.46, 9.19, 'Milano|밀란'],
  ['나폴리', 'Naples', 'IT', 'Europe/Rome', 40.85, 14.27, 'Napoli'],
  ['아말피', 'Amalfi', 'IT', 'Europe/Rome', 40.63, 14.6, '포지타노|Positano'],
  ['친퀘테레', 'Cinque Terre', 'IT', 'Europe/Rome', 44.13, 9.71],
  ['시칠리아', 'Sicily', 'IT', 'Europe/Rome', 37.6, 14.02, '팔레르모|Palermo|시칠리'],
  ['바르셀로나', 'Barcelona', 'ES', 'Europe/Madrid', 41.39, 2.17],
  ['마드리드', 'Madrid', 'ES', 'Europe/Madrid', 40.42, -3.7],
  ['세비야', 'Seville', 'ES', 'Europe/Madrid', 37.39, -5.98, 'Sevilla|세빌리아'],
  ['그라나다', 'Granada', 'ES', 'Europe/Madrid', 37.18, -3.6],
  ['말라가', 'Malaga', 'ES', 'Europe/Madrid', 36.72, -4.42],
  ['마요르카', 'Mallorca', 'ES', 'Europe/Madrid', 39.7, 2.98, '팔마|Majorca'],
  ['리스본', 'Lisbon', 'PT', 'Europe/Lisbon', 38.72, -9.14, 'Lisboa'],
  ['포르투', 'Porto', 'PT', 'Europe/Lisbon', 41.15, -8.61],
  ['베를린', 'Berlin', 'DE', 'Europe/Berlin', 52.52, 13.4],
  ['뮌헨', 'Munich', 'DE', 'Europe/Berlin', 48.14, 11.58, 'München|Muenchen'],
  ['프랑크푸르트', 'Frankfurt', 'DE', 'Europe/Berlin', 50.11, 8.68],
  ['하이델베르크', 'Heidelberg', 'DE', 'Europe/Berlin', 49.4, 8.67],
  ['함부르크', 'Hamburg', 'DE', 'Europe/Berlin', 53.55, 9.99],
  ['퓌센', 'Füssen', 'DE', 'Europe/Berlin', 47.57, 10.7, '노이슈반슈타인|Fussen'],
  ['암스테르담', 'Amsterdam', 'NL', 'Europe/Amsterdam', 52.37, 4.9],
  ['브뤼셀', 'Brussels', 'BE', 'Europe/Brussels', 50.85, 4.35, '브루셀'],
  ['브뤼헤', 'Bruges', 'BE', 'Europe/Brussels', 51.21, 3.22, 'Brugge'],
  ['취리히', 'Zurich', 'CH', 'Europe/Zurich', 47.38, 8.54, 'Zürich'],
  ['인터라켄', 'Interlaken', 'CH', 'Europe/Zurich', 46.69, 7.86, '융프라우|Jungfrau'],
  ['루체른', 'Lucerne', 'CH', 'Europe/Zurich', 47.05, 8.31, 'Luzern'],
  ['제네바', 'Geneva', 'CH', 'Europe/Zurich', 46.2, 6.14],
  ['체르마트', 'Zermatt', 'CH', 'Europe/Zurich', 46.02, 7.75, '마테호른'],
  ['빈', 'Vienna', 'AT', 'Europe/Vienna', 48.21, 16.37, '비엔나|Wien'],
  ['잘츠부르크', 'Salzburg', 'AT', 'Europe/Vienna', 47.81, 13.06],
  ['할슈타트', 'Hallstatt', 'AT', 'Europe/Vienna', 47.56, 13.65],
  ['프라하', 'Prague', 'CZ', 'Europe/Prague', 50.08, 14.44, 'Praha'],
  ['체스키크룸로프', 'Český Krumlov', 'CZ', 'Europe/Prague', 48.81, 14.32, 'Cesky Krumlov'],
  ['부다페스트', 'Budapest', 'HU', 'Europe/Budapest', 47.5, 19.04],
  ['바르샤바', 'Warsaw', 'PL', 'Europe/Warsaw', 52.23, 21.01],
  ['크라쿠프', 'Krakow', 'PL', 'Europe/Warsaw', 50.06, 19.94, '크라코프|Kraków'],
  ['두브로브니크', 'Dubrovnik', 'HR', 'Europe/Zagreb', 42.65, 18.09],
  ['자그레브', 'Zagreb', 'HR', 'Europe/Zagreb', 45.82, 15.98],
  ['스플리트', 'Split', 'HR', 'Europe/Zagreb', 43.51, 16.44],
  ['플리트비체', 'Plitvice', 'HR', 'Europe/Zagreb', 44.88, 15.62],
  ['류블랴나', 'Ljubljana', 'SI', 'Europe/Ljubljana', 46.06, 14.51],
  ['블레드', 'Bled', 'SI', 'Europe/Ljubljana', 46.37, 14.11],
  ['아테네', 'Athens', 'GR', 'Europe/Athens', 37.98, 23.73],
  ['산토리니', 'Santorini', 'GR', 'Europe/Athens', 36.39, 25.46, '이아|Oia'],
  ['미코노스', 'Mykonos', 'GR', 'Europe/Athens', 37.45, 25.33],
  ['코펜하겐', 'Copenhagen', 'DK', 'Europe/Copenhagen', 55.68, 12.57],
  ['스톡홀름', 'Stockholm', 'SE', 'Europe/Stockholm', 59.33, 18.07],
  ['오슬로', 'Oslo', 'NO', 'Europe/Oslo', 59.91, 10.75],
  ['베르겐', 'Bergen', 'NO', 'Europe/Oslo', 60.39, 5.32],
  ['트롬쇠', 'Tromsø', 'NO', 'Europe/Oslo', 69.65, 18.96, 'Tromso|트롬소'],
  ['헬싱키', 'Helsinki', 'FI', 'Europe/Helsinki', 60.17, 24.94],
  ['로바니에미', 'Rovaniemi', 'FI', 'Europe/Helsinki', 66.5, 25.73, '산타마을'],
  ['레이캬비크', 'Reykjavik', 'IS', 'Atlantic/Reykjavik', 64.15, -21.94, '레이캬비크|레이카비크'],
  ['탈린', 'Tallinn', 'EE', 'Europe/Tallinn', 59.44, 24.75],
  ['리가', 'Riga', 'LV', 'Europe/Riga', 56.95, 24.11],
  ['빌뉴스', 'Vilnius', 'LT', 'Europe/Vilnius', 54.69, 25.28],
  ['몰타', 'Malta', 'MT', 'Europe/Malta', 35.9, 14.51, '발레타|Valletta'],
  ['코토르', 'Kotor', 'ME', 'Europe/Podgorica', 42.42, 18.77],
  ['부쿠레슈티', 'Bucharest', 'RO', 'Europe/Bucharest', 44.43, 26.1],
  ['소피아', 'Sofia', 'BG', 'Europe/Sofia', 42.7, 23.32],
  ['모스크바', 'Moscow', 'RU', 'Europe/Moscow', 55.76, 37.62],
  ['상트페테르부르크', 'Saint Petersburg', 'RU', 'Europe/Moscow', 59.93, 30.34, '페테르부르크'],
  ['블라디보스토크', 'Vladivostok', 'RU', 'Asia/Vladivostok', 43.12, 131.89, '블라디'],
  // 아프리카
  ['카이로', 'Cairo', 'EG', 'Africa/Cairo', 30.04, 31.24, '피라미드'],
  ['마라케시', 'Marrakech', 'MA', 'Africa/Casablanca', 31.63, -7.99, '마라케쉬|Marrakesh'],
  ['케이프타운', 'Cape Town', 'ZA', 'Africa/Johannesburg', -33.92, 18.42],
  ['나이로비', 'Nairobi', 'KE', 'Africa/Nairobi', -1.29, 36.82],
  ['잔지바르', 'Zanzibar', 'TZ', 'Africa/Dar_es_Salaam', -6.17, 39.2],
  ['모리셔스', 'Mauritius', 'MU', 'Indian/Mauritius', -20.35, 57.55],
  // 아메리카
  ['뉴욕', 'New York', 'US', 'America/New_York', 40.71, -74.01, 'NYC|맨해튼|Manhattan'],
  ['로스앤젤레스', 'Los Angeles', 'US', 'America/Los_Angeles', 34.05, -118.24, 'LA|엘에이'],
  ['샌프란시스코', 'San Francisco', 'US', 'America/Los_Angeles', 37.77, -122.42, 'SF'],
  ['라스베이거스', 'Las Vegas', 'US', 'America/Los_Angeles', 36.17, -115.14, '라스베가스|베가스'],
  [
    '하와이',
    'Honolulu',
    'US',
    'Pacific/Honolulu',
    21.31,
    -157.86,
    '호놀룰루|오아후|Hawaii|Oahu|와이키키',
  ],
  ['마우이', 'Maui', 'US', 'Pacific/Honolulu', 20.8, -156.33],
  ['시애틀', 'Seattle', 'US', 'America/Los_Angeles', 47.61, -122.33],
  ['샌디에이고', 'San Diego', 'US', 'America/Los_Angeles', 32.72, -117.16, '샌디에고'],
  ['시카고', 'Chicago', 'US', 'America/Chicago', 41.88, -87.63],
  ['보스턴', 'Boston', 'US', 'America/New_York', 42.36, -71.06],
  [
    '워싱턴 D.C.',
    'Washington, D.C.',
    'US',
    'America/New_York',
    38.91,
    -77.04,
    '워싱턴|Washington DC',
  ],
  ['마이애미', 'Miami', 'US', 'America/New_York', 25.76, -80.19],
  ['올랜도', 'Orlando', 'US', 'America/New_York', 28.54, -81.38],
  ['그랜드캐니언', 'Grand Canyon', 'US', 'America/Phoenix', 36.11, -112.11, '그랜드캐년'],
  ['앵커리지', 'Anchorage', 'US', 'America/Anchorage', 61.22, -149.9, '알래스카|Alaska'],
  ['괌', 'Guam', 'GU', 'Pacific/Guam', 13.44, 144.79],
  ['사이판', 'Saipan', 'MP', 'Pacific/Saipan', 15.18, 145.75],
  ['밴쿠버', 'Vancouver', 'CA', 'America/Vancouver', 49.28, -123.12],
  ['토론토', 'Toronto', 'CA', 'America/Toronto', 43.65, -79.38, '나이아가라|Niagara'],
  ['몬트리올', 'Montreal', 'CA', 'America/Toronto', 45.5, -73.57],
  ['퀘벡', 'Quebec City', 'CA', 'America/Toronto', 46.81, -71.21, 'Québec'],
  ['밴프', 'Banff', 'CA', 'America/Edmonton', 51.18, -115.57, '캘거리|Calgary'],
  ['칸쿤', 'Cancun', 'MX', 'America/Cancun', 21.16, -86.85, 'Cancún'],
  ['멕시코시티', 'Mexico City', 'MX', 'America/Mexico_City', 19.43, -99.13],
  ['아바나', 'Havana', 'CU', 'America/Havana', 23.11, -82.37, '하바나|쿠바'],
  ['쿠스코', 'Cusco', 'PE', 'America/Lima', -13.53, -71.97, '마추픽추|Machu Picchu'],
  ['리마', 'Lima', 'PE', 'America/Lima', -12.05, -77.04],
  ['우유니', 'Uyuni', 'BO', 'America/La_Paz', -20.46, -66.83, '우유니 소금사막'],
  ['부에노스아이레스', 'Buenos Aires', 'AR', 'America/Argentina/Buenos_Aires', -34.6, -58.38],
  ['리우데자네이루', 'Rio de Janeiro', 'BR', 'America/Sao_Paulo', -22.91, -43.17, '리우|Rio'],
  ['상파울루', 'São Paulo', 'BR', 'America/Sao_Paulo', -23.55, -46.63, 'Sao Paulo'],
  ['산티아고', 'Santiago', 'CL', 'America/Santiago', -33.45, -70.67],
  // 오세아니아
  ['시드니', 'Sydney', 'AU', 'Australia/Sydney', -33.87, 151.21],
  ['멜버른', 'Melbourne', 'AU', 'Australia/Melbourne', -37.81, 144.96, '멜번'],
  ['브리즈번', 'Brisbane', 'AU', 'Australia/Brisbane', -27.47, 153.03],
  ['골드코스트', 'Gold Coast', 'AU', 'Australia/Brisbane', -28.02, 153.4],
  ['케언스', 'Cairns', 'AU', 'Australia/Brisbane', -16.92, 145.77, '케언즈'],
  ['퍼스', 'Perth', 'AU', 'Australia/Perth', -31.95, 115.86],
  ['오클랜드', 'Auckland', 'NZ', 'Pacific/Auckland', -36.85, 174.76],
  ['퀸스타운', 'Queenstown', 'NZ', 'Pacific/Auckland', -45.03, 168.66],
  ['크라이스트처치', 'Christchurch', 'NZ', 'Pacific/Auckland', -43.53, 172.64],
  ['피지', 'Fiji', 'FJ', 'Pacific/Fiji', -17.78, 177.44, '난디|Nadi'],
  ['팔라우', 'Palau', 'PW', 'Pacific/Palau', 7.34, 134.48, '코로르'],
  ['타히티', 'Tahiti', 'PF', 'Pacific/Tahiti', -17.65, -149.43, '보라보라|Bora Bora'],
  ['누메아', 'Noumea', 'NC', 'Pacific/Noumea', -22.27, 166.46, '뉴칼레도니아|New Caledonia'],
];

export interface CityInfo {
  ko: string;
  en: string;
  countryCode: string;
  timezone: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export interface CountryInfo {
  countryCode: string;
  ko: string;
  en: string;
  /** 대표 도시(목록 첫 도시)의 시간대·좌표 */
  timezone: string;
  lat: number;
  lng: number;
}

export type PlaceHit =
  | ({ kind: 'city'; score: number } & CityInfo & { countryKo: string })
  | ({ kind: 'country'; score: number } & CountryInfo);

let cache: { cities: CityInfo[]; countries: CountryInfo[] } | null = null;

function regionName(code: string, locale: 'ko' | 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const GEN_TZ: Record<string, string> = { KR: 'Asia/Seoul', JP: 'Asia/Tokyo', TW: 'Asia/Taipei' };

/** 자동 생성한 전체 시·군·정·촌 목록 (placesGen.ts) → 행 */
function genRows(): PlaceRow[] {
  return Object.entries(GEN_PLACES).flatMap(([cc, text]) =>
    text.split('\n').map((line): PlaceRow => {
      const [ko = '', en = '', lat = '0', lng = '0', aliases] = line.split(',');
      const tz = GEN_TZ[cc] ?? 'UTC';
      return aliases ? [ko, en, cc, tz, +lat, +lng, aliases] : [ko, en, cc, tz, +lat, +lng];
    }),
  );
}

function load() {
  if (cache) return cache;
  const seen = new Set<string>();
  const rows = [...ROWS, ...ASIA_ROWS, ...TRAVEL_ROWS, ...genRows()].filter(([ko, , cc]) => {
    const key = `${ko}|${cc}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const cities = rows.map(([ko, en, countryCode, timezone, lat, lng, aliases]) => ({
    ko,
    en,
    countryCode,
    timezone,
    lat,
    lng,
    aliases: aliases ? aliases.split('|') : [],
  }));
  // 구·도쿄 23구 같은 별칭을 기존 도시에 붙인다
  for (const line of `${GEN_ALIASES}\n${AIRPORT_ALIASES}`.split('\n')) {
    const [cc, ko, names = ''] = line.split(',');
    const city = cities.find((c) => c.countryCode === cc && c.ko === ko);
    if (city) city.aliases.push(...names.split('|'));
  }
  const countries: CountryInfo[] = [];
  for (const c of cities) {
    if (countries.some((x) => x.countryCode === c.countryCode)) continue;
    countries.push({
      countryCode: c.countryCode,
      ko: regionName(c.countryCode, 'ko'),
      en: regionName(c.countryCode, 'en'),
      timezone: c.timezone,
      lat: c.lat,
      lng: c.lng,
    });
  }
  cache = { cities, countries };
  return cache;
}

export function allCities(): readonly CityInfo[] {
  return load().cities;
}

export function findCountry(code: string): CountryInfo | undefined {
  return load().countries.find((c) => c.countryCode === code);
}

export function findCityByName(name: string): CityInfo | undefined {
  const n = normalize(name);
  return load().cities.find((c) => normalize(c.ko) === n || normalize(c.en) === n);
}

/** 국기 이모지 (국가 코드 → 지역 표시 문자) */
export function flagEmoji(countryCode: string): string {
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)),
  );
}

/** 검색용 정규화: 소문자, 공백·기호 제거, 라틴 악센트 제거 (é → e). 한글은 그대로 */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\-'.·,()]/g, '');
}

const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/** 한글 초성만 뽑기 ("도쿄" → "ㄷㅋ") */
export function choseong(s: string): string {
  return [...s]
    .map((ch) => {
      const code = ch.charCodeAt(0) - 0xac00;
      return code >= 0 && code < 11172 ? CHOSEONG[Math.floor(code / 588)] : ch;
    })
    .join('');
}

const isChoseongQuery = (q: string) => /^[ㄱ-ㅎ]+$/.test(q);

function scoreNames(q: string, names: readonly string[], ko: string): number {
  let best = 0;
  names.forEach((name, i) => {
    const n = normalize(name);
    if (!n) return;
    // 별칭(3번째부터)이 정확히 맞으면 이름보다 조금 낮게 — "비에이"는 비에이가 후라노(별칭)보다 먼저
    if (n === q) best = Math.max(best, i < 2 ? 100 : 95);
    else if (n.startsWith(q)) best = Math.max(best, 80);
    else if (q.length >= 2 && n.includes(q)) best = Math.max(best, 50);
  });
  if (isChoseongQuery(q)) {
    const cs = choseong(normalize(ko));
    if (cs === q) best = Math.max(best, 70);
    else if (cs.startsWith(q)) best = Math.max(best, 60);
  }
  return best;
}

/**
 * 도시·국가 검색 (한글·영어·별칭·초성). 점수 높은 순, 같으면 인기순.
 * 국가는 정확히 맞거나 앞부분이 맞을 때만 (예: "일본", "japan", "jap").
 */
export function searchPlaces(query: string, limit = 20): PlaceHit[] {
  const q = normalize(query);
  if (!q) return [];
  const { cities, countries } = load();
  const hits: PlaceHit[] = [];
  countries.forEach((c) => {
    const score = scoreNames(q, [c.ko, c.en], c.ko);
    if (score >= 60) hits.push({ kind: 'country', score: score + 1, ...c });
  });
  cities.forEach((c) => {
    const score = scoreNames(q, [c.ko, c.en, ...c.aliases], c.ko);
    if (score > 0) {
      hits.push({
        kind: 'city',
        score,
        ...c,
        countryKo: findCountry(c.countryCode)?.ko ?? c.countryCode,
      });
    }
  });
  // 정렬은 안정 정렬이라 같은 점수면 데이터 순서(인기순)가 유지된다
  const top = hits.sort((a, b) => b.score - a.score).slice(0, limit);
  // 나라 이름을 정확히 치면 ("일본", "japan") 그 나라 도시 전부를 인기순으로 뒤에 붙인다
  const exact = top.find((h) => h.kind === 'country' && h.score > 100);
  if (!exact) return top;
  const shown = new Set(top.map((h) => `${h.ko}|${h.countryCode}`));
  const countryKo = exact.ko;
  return [
    ...top,
    ...cities
      .filter((c) => c.countryCode === exact.countryCode && !shown.has(`${c.ko}|${c.countryCode}`))
      .map((c): PlaceHit => ({ kind: 'city', score: 0, ...c, countryKo })),
  ];
}

/** 검색어가 없을 때 보여줄 인기 도시 */
export function popularCities(n = 16): CityInfo[] {
  const picks = [
    '도쿄',
    '오사카',
    '후쿠오카',
    '제주',
    '부산',
    '다낭',
    '방콕',
    '타이베이',
    '홍콩',
    '싱가포르',
    '세부',
    '발리',
    '괌',
    '파리',
    '런던',
    '뉴욕',
  ];
  const { cities } = load();
  return picks
    .map((ko) => cities.find((c) => c.ko === ko))
    .filter((c): c is CityInfo => !!c)
    .slice(0, n);
}
