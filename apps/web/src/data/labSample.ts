import { addDays, todayIn, type ItemKind, type LocalDate } from '@trippocket/shared';
import { LABS, setLab } from './labsStore';
import { bookingRepo } from './repositories/bookingRepo';
import { itemRepo } from './repositories/itemRepo';
import { savedPlaceRepo, SavedLimitError } from './repositories/savedPlaceRepo';
import { tripRepo } from './repositories/tripRepo';

/**
 * 관리자 실험실 "샘플 테스트" (사용자 요청 2026-10-26, 2026-10-27 최신 기능 반영): 당장 볼 수 없는 화면을 한 번에 보려고
 * - 오늘 출발 도쿄 5일: 항공(출발 확인)·숙소·지금 기준 지난/진행 중/다음 일정(방문 버튼·다음 일정 바)·메모·가고 싶은 곳,
 *   좌표 있는 목적지(일출·일몰·여행지 특보·하루 동선), 지운 일정 1개(삭제 기록 복원)
 * - 6일 뒤 타이베이 3일: 다가오는 여행(준비 현황·특보 점·대만 기상 특보·입국 항목)
 * - 지난 오사카 여행·1년 전 도쿄 여행: 방문 기록·여행 회고·"방문기록 N회"(센소지)
 * - 저장 장소. 제목·메모의 [샘플]로 알아보고 지운다. 실험실 기능도 모두 켠다. 만든 지금 여행 id를 돌려준다
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

export async function createLabSample(): Promise<string> {
  const today = todayIn(TZ);
  const day = (n: number) => addDays(today, n);
  const trip = await tripRepo.create({
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
  });

  // 항공: 오늘 아침 출국(출발 날이라 [확인]·빨간 깜빡임), 5일차 귀국. 숙소 4박 (일정표에는 일정 화면을 열 때 들어간다)
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '대한항공 KE703',
    provider: '대한항공',
    confirmationNo: 'SMPL01',
    start: { date: today, time: '06:30', place: 'ICN' },
    end: { date: today, time: '08:50', place: 'NRT' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: '대한항공 KE704',
    provider: '대한항공',
    confirmationNo: 'SMPL02',
    start: { date: day(4), time: '18:30', place: 'NRT' },
    end: { date: day(4), time: '21:10', place: 'ICN' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '호텔 그레이스리 신주쿠',
    confirmationNo: 'HTL777',
    start: { date: today, time: '15:00' },
    end: { date: day(4), time: '11:00' },
    details: { address: '도쿄 신주쿠구 가부키초 1-19-1' },
  });

  // 오늘: 지금 시각 기준 — 앞의 둘은 끝남(방문 버튼), 하나는 진행 중(강조·출발 시각), 뒤는 다음 일정
  const now = mins(nowInTokyo());
  const [a, b, c, d, e] = TOKYO[0]!;
  await makeItem(trip.id, today, a!, hhmm(now - 180), { endTime: hhmm(now - 120) });
  await makeItem(trip.id, today, b!, hhmm(now - 100), { endTime: hhmm(now - 60) });
  await makeItem(trip.id, today, c!, hhmm(now - 30), { endTime: hhmm(now + 60) });
  await makeItem(trip.id, today, d!, hhmm(now + 75));
  await makeItem(trip.id, today, e!, hhmm(now + 180));
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
  // 지운 일정 하나 (마이 → 삭제 기록 복원에서 되살리기)
  const gone = await makeItem(
    trip.id,
    day(1),
    P('스카이트리', 'place', 35.7101, 139.8107, '도쿄 스미다구 오시아게 1-1-2'),
  );
  await itemRepo.softDelete(gone.id);

  // 6일 뒤 타이베이 3일 (다가오는 여행: 준비 현황·여행지 특보·대만 입국 항목)
  const taipei = await tripRepo.create({
    title: `${SAMPLE_MARK} 타이베이 3일`,
    destinations: [
      {
        name: '타이베이',
        kind: 'city',
        countryCode: 'TW',
        timezone: 'Asia/Taipei',
        coords: { lat: 25.033, lng: 121.5654 },
      },
    ],
    startDate: day(6),
    endDate: day(8),
    timezone: 'Asia/Taipei',
    cover: { emoji: '🧋', color: '#FF6B4A' },
  });
  await bookingRepo.create({
    tripId: taipei.id,
    kind: 'flight',
    title: '에바항공 BR169',
    provider: '에바항공',
    confirmationNo: 'SMPL03',
    start: { date: day(6), time: '09:00', place: 'ICN' },
    end: { date: day(6), time: '10:40', place: 'TPE' },
  });
  for (const [n, s] of [
    P('타이베이 101', 'place', 25.0339, 121.5645, '타이베이 신이구 신이로 5단 7'),
    P('딘타이펑 신이점', 'food', 25.0331, 121.5654, '타이베이 신이구 숭가오로 194'),
    P('스린 야시장', 'food', 25.0881, 121.5241, '타이베이 스린구 지허로 101'),
  ].entries())
    await makeItem(taipei.id, day(6 + Math.min(n, 2)), s, hhmm(11 * 60 + n * 180));

  // 지난 여행 (기록 탭: 방문 기록·여행 회고)
  const past = await tripRepo.create({
    title: `${SAMPLE_MARK} 지난 오사카 여행`,
    destinations: [
      {
        name: '오사카',
        kind: 'city',
        countryCode: 'JP',
        timezone: TZ,
        coords: { lat: 34.6937, lng: 135.5023 },
      },
    ],
    startDate: addDays(today, -90),
    endDate: addDays(today, -88),
    timezone: TZ,
    cover: { emoji: '🏯' },
  });
  await bookingRepo.create({
    tripId: past.id,
    kind: 'flight',
    title: '진에어 LJ201',
    start: { date: addDays(today, -90), time: '08:00', place: 'ICN' },
    end: { date: addDays(today, -90), time: '09:50', place: 'KIX' },
  });
  const osaka = [
    P('오사카성', 'place', 34.6873, 135.5262, '오사카 주오구 오사카조 1-1'),
    P('도톤보리', 'food', 34.6687, 135.5013, '오사카 주오구 도톤보리 1'),
    P('구로몬 시장', 'food', 34.6655, 135.5066, '오사카 주오구 닛폰바시 2-4-1'),
    P('신세카이', 'place', 34.6525, 135.5063, '오사카 나니와구 에비스히가시'),
  ];
  for (const [n, s] of osaka.entries()) {
    const it = await makeItem(past.id, addDays(today, -89), s, hhmm(10 * 60 + n * 120));
    await itemRepo.setVisit(it.id, n === 3 ? 'skipped' : 'visited');
  }

  // 1년 전 도쿄 여행 — 오늘 센소지에 "방문기록 1회"
  const lastYear = await tripRepo.create({
    title: `${SAMPLE_MARK} 작년 도쿄 여행`,
    destinations: [
      {
        name: '도쿄',
        kind: 'city',
        countryCode: 'JP',
        timezone: TZ,
        coords: { lat: 35.6812, lng: 139.7671 },
      },
    ],
    startDate: addDays(today, -365),
    endDate: addDays(today, -363),
    timezone: TZ,
    cover: { emoji: '⛩️' },
  });
  for (const [n, s] of [TOKYO[0]![0]!, TOKYO[2]![0]!].entries()) {
    const it = await makeItem(lastYear.id, addDays(today, -364), s, hhmm(10 * 60 + n * 180));
    await itemRepo.setVisit(it.id, 'visited');
  }

  // 저장한 장소 (저장 탭 나라 칸·일정 추가 고르기)
  const saved = [
    { name: '사루타히코 커피', kind: 'cafe', countryCode: 'JP', cityTag: '도쿄' },
    { name: '스시 잔마이', kind: 'food', countryCode: 'JP', cityTag: '도쿄' },
    { name: '나카메구로', kind: 'place', countryCode: 'JP', cityTag: '도쿄' },
    { name: '딘타이펑 신이점', kind: 'food', countryCode: 'TW', cityTag: '타이베이' },
  ] as const;
  for (const s of saved) {
    try {
      await savedPlaceRepo.create({ ...s, memo: SAMPLE_MARK });
    } catch (e) {
      if (!(e instanceof SavedLimitError)) throw e;
    }
  }

  for (const id of LABS) setLab(id, true);
  return trip.id;
}

/** [샘플]로 만든 여행·저장 장소 지우기. 지운 여행 수 */
export async function removeLabSample(): Promise<number> {
  const trips = (await tripRepo.listActive()).filter((t) => t.title.startsWith(SAMPLE_MARK));
  for (const t of trips) {
    // 안의 일정·예약까지 (여행만 지우면 방문 기록 등이 남는다)
    for (const i of await itemRepo.listByTrip(t.id)) await itemRepo.softDelete(i.id);
    for (const b of await bookingRepo.listByTrip(t.id)) await bookingRepo.softDelete(b.id);
    await tripRepo.softDelete(t.id);
  }
  for (const p of await savedPlaceRepo.listActive())
    if (p.memo === SAMPLE_MARK) await savedPlaceRepo.softDelete(p.id);
  return trips.length;
}
