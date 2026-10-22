import type { PlaceRow } from './placesAsia';

/**
 * 한국인이 많이 가는 관광지 추가분 + 공항 이름·코드 별칭.
 * 행 형식은 placesAsia.ts와 같다. 같은 이름·국가가 앞에 있으면 앞쪽 우선.
 */
export const TRAVEL_ROWS: PlaceRow[] = [
  ['시안', "Xi'an", 'CN', 'Asia/Shanghai', 34.34, 108.94, '서안|병마용|Xian'],
  ['하장', 'Ha Giang', 'VN', 'Asia/Ho_Chi_Minh', 22.82, 104.98, '하지앙|Hà Giang'],
  ['꼰다오', 'Con Dao', 'VN', 'Asia/Ho_Chi_Minh', 8.68, 106.6, '콘다오'],
  ['코란타', 'Ko Lanta', 'TH', 'Asia/Bangkok', 7.62, 99.08, '란타'],
  [
    '빅아일랜드',
    'Big Island',
    'US',
    'Pacific/Honolulu',
    19.64,
    -155.99,
    '코나|힐로|Kona|Hilo|하와이섬',
  ],
  ['카우아이', 'Kauai', 'US', 'Pacific/Honolulu', 22.07, -159.5, '카우아이섬'],
  ['요세미티', 'Yosemite', 'US', 'America/Los_Angeles', 37.75, -119.59, '요세미티국립공원'],
  ['세도나', 'Sedona', 'US', 'America/Phoenix', 34.87, -111.76],
  [
    '페이지',
    'Page',
    'US',
    'America/Phoenix',
    36.91,
    -111.46,
    '앤털로프캐니언|앤텔롭캐니언|홀슈밴드|Antelope Canyon',
  ],
  ['뉴올리언스', 'New Orleans', 'US', 'America/Chicago', 29.95, -90.07],
  ['옐로나이프', 'Yellowknife', 'CA', 'America/Yellowknife', 62.45, -114.37, '오로라'],
  ['휘슬러', 'Whistler', 'CA', 'America/Vancouver', 50.12, -122.95],
  ['재스퍼', 'Jasper', 'CA', 'America/Edmonton', 52.88, -118.08],
  ['울루루', 'Uluru', 'AU', 'Australia/Darwin', -25.34, 131.04, '에어즈록|Ayers Rock'],
  ['호바트', 'Hobart', 'AU', 'Australia/Hobart', -42.88, 147.33, '태즈메이니아|Tasmania'],
  ['애들레이드', 'Adelaide', 'AU', 'Australia/Adelaide', -34.93, 138.6],
  ['로토루아', 'Rotorua', 'NZ', 'Pacific/Auckland', -38.14, 176.25],
  ['테카포', 'Tekapo', 'NZ', 'Pacific/Auckland', -44.0, 170.48, '데카포|레이크테카포'],
  ['웰링턴', 'Wellington', 'NZ', 'Pacific/Auckland', -41.29, 174.78],
  ['그린델발트', 'Grindelwald', 'CH', 'Europe/Zurich', 46.62, 8.04],
  ['인스브루크', 'Innsbruck', 'AT', 'Europe/Vienna', 47.27, 11.39],
  ['쾰른', 'Köln', 'DE', 'Europe/Berlin', 50.94, 6.96, 'Cologne'],
  ['드레스덴', 'Dresden', 'DE', 'Europe/Berlin', 51.05, 13.74],
  ['보르도', 'Bordeaux', 'FR', 'Europe/Paris', 44.84, -0.58],
  ['안시', 'Annecy', 'FR', 'Europe/Paris', 45.9, 6.13],
  ['콜마르', 'Colmar', 'FR', 'Europe/Paris', 48.08, 7.36],
  ['베로나', 'Verona', 'IT', 'Europe/Rome', 45.44, 10.99],
  ['돌로미티', 'Dolomiti', 'IT', 'Europe/Rome', 46.54, 12.14, '코르티나담페초|Dolomites'],
  ['빌바오', 'Bilbao', 'ES', 'Europe/Madrid', 43.26, -2.93],
  ['산세바스티안', 'San Sebastián', 'ES', 'Europe/Madrid', 43.32, -1.98],
  ['이비사', 'Ibiza', 'ES', 'Europe/Madrid', 38.91, 1.43, '이비자'],
  ['테네리페', 'Tenerife', 'ES', 'Atlantic/Canary', 28.29, -16.63],
  ['신트라', 'Sintra', 'PT', 'Europe/Lisbon', 38.8, -9.38],
  ['옥스퍼드', 'Oxford', 'GB', 'Europe/London', 51.75, -1.26],
  ['케임브리지', 'Cambridge', 'GB', 'Europe/London', 52.21, 0.12],
  ['바스', 'Bath', 'GB', 'Europe/London', 51.38, -2.36, '코츠월드|Cotswolds'],
  ['플롬', 'Flåm', 'NO', 'Europe/Oslo', 60.86, 7.11, 'Flam'],
  ['로포텐', 'Lofoten', 'NO', 'Europe/Oslo', 68.23, 14.56],
  ['자다르', 'Zadar', 'HR', 'Europe/Zagreb', 44.12, 15.23],
  ['크레타', 'Crete', 'GR', 'Europe/Athens', 35.34, 25.14, '이라클리온|Heraklion'],
  ['파묵칼레', 'Pamukkale', 'TR', 'Europe/Istanbul', 37.92, 29.12],
  ['페티예', 'Fethiye', 'TR', 'Europe/Istanbul', 36.62, 29.12, '욀뤼데니즈'],
  ['룩소르', 'Luxor', 'EG', 'Africa/Cairo', 25.69, 32.64],
  ['후르가다', 'Hurghada', 'EG', 'Africa/Cairo', 27.26, 33.81],
  ['다합', 'Dahab', 'EG', 'Africa/Cairo', 28.5, 34.51],
  ['셰프샤우엔', 'Chefchaouen', 'MA', 'Africa/Casablanca', 35.17, -5.27, '쉐프샤우엔'],
  ['페스', 'Fes', 'MA', 'Africa/Casablanca', 34.03, -5.0, '페즈|Fez'],
  ['메르주가', 'Merzouga', 'MA', 'Africa/Casablanca', 31.1, -4.01, '사하라|사하라사막'],
  ['아루샤', 'Arusha', 'TZ', 'Africa/Dar_es_Salaam', -3.37, 36.68, '세렝게티|Serengeti|킬리만자로'],
  ['마사이마라', 'Maasai Mara', 'KE', 'Africa/Nairobi', -1.49, 35.14, '마사이 마라'],
  [
    '엘칼라파테',
    'El Calafate',
    'AR',
    'America/Argentina/Rio_Gallegos',
    -50.34,
    -72.27,
    '파타고니아|Patagonia|페리토모레노',
  ],
  [
    '이구아수',
    'Iguazú',
    'AR',
    'America/Argentina/Cordoba',
    -25.6,
    -54.57,
    '이과수|Iguazu|포스두이구아수',
  ],
  [
    '산페드로데아타카마',
    'San Pedro de Atacama',
    'CL',
    'America/Santiago',
    -22.91,
    -68.2,
    '아타카마',
  ],
  ['라파스', 'La Paz', 'BO', 'America/La_Paz', -16.5, -68.15],
  ['툴룸', 'Tulum', 'MX', 'America/Cancun', 20.21, -87.47],
  ['플라야델카르멘', 'Playa del Carmen', 'MX', 'America/Cancun', 20.63, -87.08],
  [
    '로스카보스',
    'Los Cabos',
    'MX',
    'America/Mazatlan',
    22.89,
    -109.92,
    '카보산루카스|Cabo San Lucas',
  ],
];

/** 기존 도시에 붙이는 공항 이름·IATA 코드. 줄 = "나라,한글,별칭|별칭" */
export const AIRPORT_ALIASES = `KR,서울,김포공항|GMP
KR,인천,인천공항|인천국제공항|ICN
KR,부산,김해공항|PUS
KR,제주,제주공항|CJU
KR,대구,대구공항|TAE
KR,청주,청주공항|CJJ
KR,양양,양양공항|YNY
KR,무안,무안공항|MWX
JP,도쿄,나리타공항|하네다공항|NRT|HND
JP,오사카,간사이공항|이타미공항|KIX|ITM
JP,후쿠오카,후쿠오카공항|FUK
JP,삿포로,신치토세|신치토세공항|CTS
JP,오키나와,나하공항|OKA
JP,나고야,주부공항|센트레아|NGO
CN,상하이,푸둥공항|훙차오공항|PVG|SHA
CN,베이징,서우두공항|다싱공항|PEK|PKX
CN,칭다오,칭다오공항|TAO
HK,홍콩,첵랍콕|홍콩공항|HKG
TW,타이베이,타오위안공항|쑹산공항|송산공항|TPE|TSA
TW,가오슝,가오슝공항|KHH
TH,방콕,수완나품|돈므앙|BKK|DMK
TH,푸껫,푸껫공항|HKT
TH,치앙마이,치앙마이공항|CNX
VN,다낭,다낭공항|DAD
VN,나트랑,깜라인|깜라인공항|CXR
VN,호치민,떤선녓|탄손누트|SGN
VN,하노이,노이바이|노이바이공항|HAN
VN,푸꾸옥,푸꾸옥공항|PQC
PH,세부,막탄공항|CEB
PH,마닐라,니노이아키노|MNL
PH,클락,클락공항|CRK
PH,보라카이,까띠끌란|칼리보|Caticlan|Kalibo|MPH|KLO
SG,싱가포르,창이|창이공항|SIN
MY,쿠알라룸푸르,KLIA|KUL
MY,코타키나발루,BKI
ID,발리,응우라라이|DPS
GU,괌,괌공항|GUM
MP,사이판,사이판공항|SPN
US,뉴욕,JFK|존에프케네디|뉴어크|EWR
US,로스앤젤레스,LAX
US,샌프란시스코,SFO
US,하와이,HNL|호놀룰루공항
US,라스베이거스,LAS
FR,파리,샤를드골|CDG
GB,런던,히스로|개트윅|LHR|LGW
DE,프랑크푸르트,FRA
DE,뮌헨,MUC
NL,암스테르담,스히폴|AMS
IT,로마,피우미치노|FCO
ES,바르셀로나,BCN
AE,두바이,DXB
TR,이스탄불,IST
AU,시드니,SYD
CA,밴쿠버,YVR
CA,토론토,YYZ`;
