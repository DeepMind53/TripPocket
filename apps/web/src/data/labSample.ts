import {
  addDays,
  essentialKey,
  todayIn,
  uuidv7,
  type ItemKind,
  type LocalDate,
} from '@trippocket/shared';
import { bookingRepo } from './repositories/bookingRepo';
import { dayNoteRepo } from './repositories/dayNoteRepo';
import { checklistRepo, type PrepList } from './repositories/checklistRepo';
import { itemRepo } from './repositories/itemRepo';
import { savedPlaceRepo, SavedLimitError } from './repositories/savedPlaceRepo';
import { tripRepo } from './repositories/tripRepo';

/**
 * 실험실 "샘플 테스트" (2026-11-03 모든 사용자, 24시간 뒤 자동 삭제). 당장 볼 수 없는 화면을 한 번에 보려고.
 * 2026-11-23 사용자 요청: 일본·대만·한국 나라마다 하나씩, 모든 기능을 써 보거나 볼 수 있게 — 여행 시점을 나눈다
 * - 🇯🇵 도쿄 5일 (오늘 출발 = 여행 중): 예약 6종(항공·픽업·기차·숙소·식당·입장권), 지금 기준 지난/진행 중/다음 일정
 *   (방문 버튼·다음 일정 바·여행 모드), 이동 일정·메모·링크, Plan B 2개, 준비물·할 일, 하루 한 줄 기록, 가고 싶은 곳, 지운 일정 1개
 * - 🇹🇼 타이베이 4일 (6일 뒤 = 다가오는 여행): 항공·숙소(조식)·투어·기차, 준비물 일부 체크, 할 일, 필수 항목 일부 체크
 *   (준비 현황·D-day·여행지 특보·입국 항목)
 * - 🇰🇷 제주 3일 (한 달 전 = 지난 여행): 국내선·렌터카·숙소·식당, 방문/미방문 기록, 하루 한 줄 기록 (기록 탭·여행 회고)
 * - 나라마다 저장 장소. 제목·메모의 [샘플]로 알아보고 지운다. 만든 도쿄(여행 중) id를 돌려준다
 */
export const SAMPLE_MARK = '[샘플]';
const TZ = 'Asia/Tokyo';

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => {
  const c = Math.min(Math.max(m, 0), 23 * 60 + 59);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
};
const nowInTokyo = () =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(new Date());

type Spot = { title: string; kind: ItemKind; lat: number; lng: number; address: string };
const P = (title: string, kind: ItemKind, lat: number, lng: number, address: string): Spot => ({
  title,
  kind,
  lat,
  lng,
  address,
});

const TOKYO: Spot[][] = [
  [
    P('센소지', 'place', 35.7148, 139.7967, '도쿄 다이토구 아사쿠사 2-3-1'),
    P('아사쿠사 멘치', 'food', 35.7128, 139.7951, '도쿄 다이토구 아사쿠사 2-3-3'),
    P('우에노 공원', 'place', 35.7156, 139.7745, '도쿄 다이토구 우에노 공원'),
    P('아메요코 시장', 'shopping', 35.7107, 139.7745, '도쿄 다이토구 우에노 4'),
    P('블루보틀 기요스미', 'cafe', 35.6804, 139.8001, '도쿄 고토구 히라노 1-4-8'),
  ],
  [
    P('츠키지 장외시장', 'food', 35.6655, 139.7707, '도쿄 주오구 츠키지 4'),
    P('긴자 이토야', 'shopping', 35.6727, 139.7666, '도쿄 주오구 긴자 2-7-15'),
    P('도쿄타워', 'place', 35.6586, 139.7454, '도쿄 미나토구 시바코엔 4-2-8'),
  ],
  [
    P('메이지 신궁', 'place', 35.6764, 139.6993, '도쿄 시부야구 요요기카미조노초 1-1'),
    P('하라주쿠 다케시타 거리', 'shopping', 35.6716, 139.7029, '도쿄 시부야구 진구마에 1'),
    P('이치란 시부야', 'food', 35.6611, 139.7001, '도쿄 시부야구 진난 1-22-7'),
    P('시부야 스카이', 'activity', 35.6585, 139.7022, '도쿄 시부야구 시부야 2-24-12'),
  ],
  [
    P('팀랩 플래닛', 'activity', 35.6492, 139.7899, '도쿄 고토구 도요스 6-1-16'),
    P('오다이바 해변공원', 'place', 35.6298, 139.7754, '도쿄 미나토구 다이바 1-4'),
  ],
];

async function makeItem(tripId: string, date: LocalDate, s: Spot, startTime?: string, extra = {}) {
  return itemRepo.create({
    tripId,
    date,
    kind: s.kind,
    title: s.title,
    ...(startTime ? { startTime } : {}),
    place: {
      name: s.title,
      address: s.address,
      coords: { lat: s.lat, lng: s.lng },
      coordsSource: 'user',
    },
    ...extra,
  });
}

/** 준비물·할 일 [글, 분류, 체크] 넣기 */
async function addPrep(
  tripId: string,
  list: PrepList,
  rows: readonly (readonly [string, string | undefined, boolean])[],
) {
  for (const [text, category, checked] of rows) {
    const it = await checklistRepo.add(tripId, list, { text, category });
    if (checked) await checklistRepo.setChecked(it.id, true);
  }
}

export async function createLabSample(): Promise<string> {
  const id = await createJapan();
  await createTaiwan();
  await createKorea();
  await createSavedPlaces();
  // 실험실 기능은 켜지 않는다 — 기본은 모두 꺼짐, 사용자가 직접 켠다 (사용자 요청 2026-11-03)
  return id;
}

/** 🇯🇵 오늘 출발 도쿄 5일 — 여행 중 화면 전부 */
async function createJapan(): Promise<string> {
  const today = todayIn(TZ);
  const day = (n: number) => addDays(today, n);
  const trip = await tripRepo.create({
    sample: true,
    title: `${SAMPLE_MARK} 도쿄 5일`,
    destinations: [
      {
        name: '도쿄',
        kind: 'city',
        countryCode: 'JP',
        timezone: TZ,
        coords: { lat: 35.6812, lng: 139.7671 },
      },
    ],
    startDate: today,
    endDate: day(4),
    timezone: TZ,
    cover: { emoji: '🗼', color: '#2F6BFF' },
    memo: `${SAMPLE_MARK} 첫날은 숙소 근처에서 가볍게`,
  });

  // 항공: 오늘 아침 출국(출발 날이라 [확인]·빨간 깜빡임), 5일차 귀국 — 편명·좌석·터미널·수하물까지
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '대한항공 KE703',
    provider: '대한항공',
    confirmationNo: 'SMPL01',
    start: { date: today, time: '06:30', place: 'ICN' },
    end: { date: today, time: '08:50', place: 'NRT' },
    details: {
      flightNo: 'KE703',
      seat: '32A',
      terminal: 'T2',
      arrivalTerminal: 'T1',
      baggage: '위탁 23kg · 기내 10kg',
      payment: 'paid',
    },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '대한항공 KE704',
    provider: '대한항공',
    confirmationNo: 'SMPL02',
    start: { date: day(4), time: '18:30', place: 'NRT' },
    end: { date: day(4), time: '21:10', place: 'ICN' },
    details: { flightNo: 'KE704', seat: '32A', terminal: 'T1', arrivalTerminal: 'T2' },
  });
  // 공항 픽업 (만나는 곳·인원)
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'transfer',
    title: '나리타 공항 픽업',
    provider: '클룩',
    confirmationNo: 'PICK21',
    start: { date: today, time: '09:30', place: '나리타 공항 T1 도착 로비' },
    details: {
      direction: 'pickup',
      partySize: 2,
      meetingPoint: '도착 로비 B 출구 앞',
      payment: 'paid',
    },
  });
  // 기차 (역 좌표 → 길찾기)
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'train',
    title: '나리타 익스프레스',
    confirmationNo: 'NEX44',
    start: {
      date: day(4),
      time: '15:03',
      place: '신주쿠역',
      coords: { lat: 35.6896, lng: 139.7006 },
    },
    end: { date: day(4), time: '16:28', place: '나리타 공항역' },
    details: { seat: '5호차 9D' },
  });
  // 숙소 (조식 날짜·객실·취소 마감·현장 결제)
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '호텔 그레이스리 신주쿠',
    confirmationNo: 'HTL777',
    start: { date: today, time: '15:00', coords: { lat: 35.6951, lng: 139.7017 } },
    end: { date: day(4), time: '11:00' },
    details: {
      address: '도쿄 신주쿠구 가부키초 1-19-1',
      phone: '+81-3-6833-2489',
      roomType: '더블룸 금연',
      breakfast: true,
      breakfastDates: [day(1), day(2)],
      cancelBy: today,
      payment: 'onsite',
    },
    priceNote: '현장 결제 4박',
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'restaurant',
    title: '스시 잔마이 본점',
    confirmationNo: 'RSV12',
    start: { date: day(1), time: '19:00', place: '도쿄 주오구 츠키지 4-11-9' },
    details: { partySize: 2, phone: '+81-3-3541-1117' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'ticket',
    title: '팀랩 플래닛 입장권',
    confirmationNo: 'TLP3001',
    start: { date: day(3), time: '10:00', place: '팀랩 플래닛 도쿄' },
    details: { voucherUrl: 'https://www.teamlab.art/ko/e/planets/', payment: 'paid' },
  });

  // 오늘: 지금 시각 기준 — 앞의 둘은 끝남(방문 버튼), 하나는 진행 중(강조·출발 시각), 뒤는 다음 일정
  const now = mins(nowInTokyo());
  const [a, b, c, d, e] = TOKYO[0]!;
  await makeItem(trip.id, today, a!, hhmm(now - 180), { endTime: hhmm(now - 120) });
  await makeItem(trip.id, today, b!, hhmm(now - 100), { endTime: hhmm(now - 60) });
  await makeItem(trip.id, today, c!, hhmm(now - 30), { endTime: hhmm(now + 60) });
  // 이동 일정 (지하철 구간)
  await itemRepo.create({
    tripId: trip.id,
    date: today,
    kind: 'transport',
    title: '긴자선 우에노 → 미쓰코시마에',
    startTime: hhmm(now + 62),
    transport: { mode: 'subway', from: '우에노', to: '미쓰코시마에' },
  });
  await makeItem(trip.id, today, d!, hhmm(now + 75));
  // 링크·메모가 있는 일정
  await makeItem(trip.id, today, e!, hhmm(now + 180), {
    url: 'https://bluebottlecoffee.jp/',
    memo: `${SAMPLE_MARK} 싱글 오리진 추천`,
  });
  await itemRepo.create({
    tripId: trip.id,
    date: today,
    kind: 'note',
    title: '메모',
    memo: `${SAMPLE_MARK} 스이카 충전 ¥3,000\n교통패스 챙기기`,
  });
  for (const [n, spots] of TOKYO.slice(1).entries()) {
    let t = 9 * 60;
    for (const s of spots) {
      await makeItem(trip.id, day(n + 1), s, hhmm(t));
      t += 150;
    }
  }
  // 날짜 없는 가고 싶은 곳
  await itemRepo.create({ tripId: trip.id, date: null, kind: 'cafe', title: '사루타히코 커피' });
  await itemRepo.create({
    tripId: trip.id,
    date: null,
    kind: 'shopping',
    title: '돈키호테 시부야',
  });
  // 지운 일정 하나 (마이 → 삭제 기록 복원에서 되살리기)
  const gone = await makeItem(
    trip.id,
    day(1),
    P('스카이트리', 'place', 35.7101, 139.8107, '도쿄 스미다구 오시아게 1-1-2'),
  );
  await itemRepo.softDelete(gone.id);

  // Plan B (실험실 "Plan B", 2026-11-03): 2일차에 비 오는 날 실내 플랜, 피곤한 날 쉬는 플랜
  const rainy = uuidv7();
  const tired = uuidv7();
  await tripRepo.update(trip.id, {
    dayPlans: [
      {
        id: rainy,
        date: day(1),
        name: 'Plan B 비 오는 날',
        match: 'any',
        conditions: [{ type: 'weather', weather: ['rain', 'snow', 'storm'] }],
      },
      {
        id: tired,
        date: day(1),
        name: 'Plan C 쉬는 날',
        match: 'any',
        conditions: [{ type: 'fatigue', value: 4 }],
      },
    ],
  });
  // 하루 한 줄 기록 (실험실, 2026-11-10 — 내 기록, 2026-11-25)
  await dayNoteRepo.set(trip.id, today, '아사쿠사 멘치카츠가 오늘의 발견');
  for (const [i, s] of [
    P('도쿄 국립박물관', 'place', 35.7188, 139.7765, '도쿄 다이토구 우에노 공원 13-9'),
    P('선샤인 시티', 'shopping', 35.729, 139.7193, '도쿄 도시마구 히가시이케부쿠로 3-1'),
  ].entries())
    await makeItem(trip.id, day(1), s, hhmm(10 * 60 + i * 180), { planId: rainy });
  await makeItem(
    trip.id,
    day(1),
    P('스파 라쿠아', 'activity', 35.7056, 139.7519, '도쿄 분쿄구 가스가 1-1-1'),
    '13:00',
    { planId: tired },
  );

  // 준비물·할 일 — 여행 중이라 거의 끝남
  await addPrep(trip.id, 'packing', [
    ['여권', '서류', true],
    ['항공권 e티켓', '서류', true],
    ['충전기·보조배터리', '전자기기', true],
    ['돼지코 어댑터', '전자기기', false],
    ['우산', '기타', false],
  ]);
  await addPrep(trip.id, 'todo', [
    ['스이카 앱 설치', undefined, true],
    ['유심 개통', undefined, true],
    ['팀랩 입장 시간 확인', undefined, false],
  ]);
  return trip.id;
}

/** 🇹🇼 6일 뒤 타이베이 4일 — 다가오는 여행 (준비 현황·D-day·여행지 특보·입국 항목) */
async function createTaiwan(): Promise<void> {
  const tz = 'Asia/Taipei';
  const today = todayIn(tz);
  const day = (n: number) => addDays(today, n);
  const trip = await tripRepo.create({
    sample: true,
    title: `${SAMPLE_MARK} 타이베이 4일`,
    destinations: [
      {
        name: '타이베이',
        kind: 'city',
        countryCode: 'TW',
        timezone: tz,
        coords: { lat: 25.033, lng: 121.5654 },
      },
    ],
    startDate: day(6),
    endDate: day(9),
    timezone: tz,
    cover: { emoji: '🧋', color: '#FF6B4A' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '에바항공 BR169',
    provider: '에바항공',
    confirmationNo: 'SMPL03',
    start: { date: day(6), time: '09:00', place: 'ICN' },
    end: { date: day(6), time: '10:40', place: 'TPE' },
    details: { flightNo: 'BR169', terminal: 'T1', arrivalTerminal: 'T2', baggage: '위탁 23kg' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '에바항공 BR170',
    provider: '에바항공',
    confirmationNo: 'SMPL04',
    start: { date: day(9), time: '11:50', place: 'TPE' },
    end: { date: day(9), time: '15:20', place: 'ICN' },
    details: { flightNo: 'BR170' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '시티즌M 타이베이 북역',
    confirmationNo: 'CZM58',
    start: { date: day(6), time: '15:00', coords: { lat: 25.0486, lng: 121.5114 } },
    end: { date: day(9), time: '11:00' },
    details: {
      address: '타이베이 다퉁구 청더로 1단 3',
      breakfast: true,
      cancelBy: day(3),
      payment: 'paid',
    },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'tour',
    title: '예스진지 버스 투어',
    provider: 'KKday',
    confirmationNo: 'KK7788',
    start: { date: day(7), time: '08:30', place: '타이베이역 M4 출구' },
    end: { date: day(7), time: '19:00' },
    details: { meetingPoint: '타이베이역 M4 출구 앞', partySize: 2, payment: 'paid' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'train',
    title: '대만 고속철 타이베이 → 타이중',
    confirmationNo: 'THSR21',
    start: { date: day(8), time: '09:16', place: '타이베이역' },
    end: { date: day(8), time: '10:05', place: '타이중역' },
    details: { seat: '7호차 12A' },
  });
  const spots: [number, string, Spot][] = [
    [6, '13:00', P('타이베이 101', 'place', 25.0339, 121.5645, '타이베이 신이구 신이로 5단 7')],
    [6, '18:00', P('딘타이펑 신이점', 'food', 25.0331, 121.5654, '타이베이 신이구 숭가오로 194')],
    [7, '20:00', P('스린 야시장', 'food', 25.0881, 121.5241, '타이베이 스린구 지허로 101')],
    [8, '13:00', P('무지개 마을', 'place', 24.1338, 120.6098, '타이중 난툰구 춘안로 56')],
    [8, '19:00', P('펑자 야시장', 'food', 24.1749, 120.6459, '타이중 시툰구 원화로')],
  ];
  for (const [n, time, s] of spots) await makeItem(trip.id, day(n), s, time);
  await addPrep(trip.id, 'packing', [
    ['여권', '서류', true],
    ['이지카드', '서류', false],
    ['110V 어댑터', '전자기기', false],
    ['우비', '의류', false],
  ]);
  await addPrep(trip.id, 'todo', [
    ['대만 입국신고서 온라인 작성', undefined, false],
    ['환전 (대만 달러)', undefined, true],
  ]);
  // 필수 항목 일부 체크 (준비 화면 "필수 항목 체크리스트 n/N")
  await checklistRepo.setEssential(trip.id, essentialKey('ALL', 'insurance'), true);
  await checklistRepo.setEssential(trip.id, essentialKey('ALL', 'data'), true);
}

/** 🇰🇷 한 달 전 제주 3일 — 지난 여행 (기록 탭·방문 기록·여행 회고) */
async function createKorea(): Promise<void> {
  const tz = 'Asia/Seoul';
  const s0 = addDays(todayIn(tz), -32);
  const day = (n: number) => addDays(s0, n);
  const trip = await tripRepo.create({
    sample: true,
    title: `${SAMPLE_MARK} 지난 제주 3일`,
    destinations: [
      {
        name: '제주',
        kind: 'city',
        countryCode: 'KR',
        timezone: tz,
        coords: { lat: 33.4996, lng: 126.5312 },
      },
    ],
    startDate: s0,
    endDate: day(2),
    timezone: tz,
    cover: { emoji: '🍊', color: '#F5A524' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '제주항공 7C101',
    provider: '제주항공',
    confirmationNo: 'SMPL05',
    start: { date: s0, time: '07:00', place: 'GMP' },
    end: { date: s0, time: '08:10', place: 'CJU' },
    details: { flightNo: '7C101' },
  });
  // 렌터카 (차종·번호·보험 — 여행 중이면 빠른 메뉴에 크게)
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'car',
    title: '제주 렌터카',
    provider: '롯데렌터카',
    confirmationNo: 'CAR909',
    start: { date: s0, time: '09:00', place: '제주공항 렌터카 하우스' },
    end: { date: day(2), time: '18:00', place: '제주공항 렌터카 하우스' },
    details: { carModel: '아이오닉 5', plate: '12하 3456', insurance: '완전자차' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '애월 바다 스테이',
    confirmationNo: 'STAY32',
    start: { date: s0, time: '16:00', coords: { lat: 33.4627, lng: 126.3094 } },
    end: { date: day(2), time: '11:00' },
    details: { address: '제주 제주시 애월읍 애월해안로 272', payment: 'paid' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'restaurant',
    title: '우진해장국',
    start: { date: day(1), time: '08:00', place: '제주 제주시 서사로 11' },
    details: { partySize: 2 },
  });
  const jeju: [number, string, Spot, 'visited' | 'skipped'][] = [
    [
      0,
      '11:00',
      P('협재 해수욕장', 'place', 33.394, 126.2397, '제주 제주시 한림읍 협재리'),
      'visited',
    ],
    [
      0,
      '14:00',
      P('애월 카페거리', 'cafe', 33.4627, 126.3094, '제주 제주시 애월읍 애월리'),
      'visited',
    ],
    [
      1,
      '06:30',
      P('성산 일출봉', 'place', 33.4581, 126.9425, '제주 서귀포시 성산읍 일출로 284-12'),
      'visited',
    ],
    [
      1,
      '10:00',
      P('섭지코지', 'place', 33.424, 126.9306, '제주 서귀포시 성산읍 섭지코지로'),
      'skipped',
    ],
    [1, '17:00', P('동문 시장', 'food', 33.5121, 126.5276, '제주 제주시 관덕로14길 20'), 'visited'],
    [
      2,
      '10:00',
      P('오설록 티뮤지엄', 'cafe', 33.3059, 126.2894, '제주 서귀포시 안덕면 신화역사로 15'),
      'visited',
    ],
  ];
  for (const [n, time, s, visit] of jeju) {
    const it = await makeItem(trip.id, day(n), s, time);
    await itemRepo.setVisit(it.id, visit);
  }
  for (const [date, text] of [
    [s0, '협재 바다 색이 사진보다 예뻤다'],
    [day(1), '일출봉은 아침 일찍 가길 잘했다'],
    [day(2), '오설록 녹차 롤케이크 또 먹고 싶다'],
  ] as const)
    await dayNoteRepo.set(trip.id, date, text);
  await addPrep(trip.id, 'packing', [
    ['운전면허증', '서류', true],
    ['선크림', '세면도구', true],
  ]);
}

/** 저장한 장소 (저장 탭 나라 칸·일정 추가 고르기) — 나라마다 */
async function createSavedPlaces(): Promise<void> {
  const saved = [
    { name: '사루타히코 커피', kind: 'cafe', countryCode: 'JP', cityTag: '도쿄' },
    { name: '스시 잔마이', kind: 'food', countryCode: 'JP', cityTag: '도쿄' },
    { name: '나카메구로', kind: 'place', countryCode: 'JP', cityTag: '도쿄' },
    { name: '딘타이펑 신이점', kind: 'food', countryCode: 'TW', cityTag: '타이베이' },
    { name: '융캉제', kind: 'place', countryCode: 'TW', cityTag: '타이베이' },
    { name: '오설록 티뮤지엄', kind: 'cafe', countryCode: 'KR', cityTag: '제주' },
    { name: '우진해장국', kind: 'food', countryCode: 'KR', cityTag: '제주' },
  ] as const;
  for (const s of saved) {
    try {
      await savedPlaceRepo.create({ ...s, memo: SAMPLE_MARK, sample: true });
    } catch (e) {
      if (!(e instanceof SavedLimitError)) throw e;
    }
  }
}

/** 샘플은 만든 지 24시간이 지나면 앱을 열 때 지운다 (사용자 요청 2026-11-03) */
export const SAMPLE_TTL_MS = 24 * 3_600_000;

/** [샘플]로 만든 여행·저장 장소 지우기 (expiredOnly = 24시간 지난 것만). 지운 여행 수 */
export async function removeLabSample(opts: { expiredOnly?: boolean } = {}): Promise<number> {
  const cutoff = Date.now() - SAMPLE_TTL_MS;
  const due = (x: { createdAt: string }) => !opts.expiredOnly || Date.parse(x.createdAt) < cutoff;
  const trips = (await tripRepo.listActive()).filter(
    (t) => t.title.startsWith(SAMPLE_MARK) && due(t),
  );
  for (const t of trips) {
    // 안의 일정·예약·준비 목록까지 (여행만 지우면 방문 기록 등이 남는다)
    for (const i of await itemRepo.listByTrip(t.id)) await itemRepo.softDelete(i.id);
    for (const b of await bookingRepo.listByTrip(t.id)) await bookingRepo.softDelete(b.id);
    for (const list of ['packing', 'todo', 'essentials'] as const)
      for (const c of await checklistRepo.list(t.id, list)) await checklistRepo.softDelete(c.id);
    await tripRepo.softDelete(t.id);
  }
  for (const p of await savedPlaceRepo.listActive())
    if (p.memo === SAMPLE_MARK && due(p)) await savedPlaceRepo.softDelete(p.id);
  return trips.length;
}
