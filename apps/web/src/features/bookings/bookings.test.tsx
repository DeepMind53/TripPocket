import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';
import { acceptDelete } from '../../test/confirm';

// 캡처 줄이기는 브라우저 그림판이 필요해서 시험에서는 그대로 넘긴다
vi.mock('../../shared/lib/shrinkImage', () => ({ shrinkImage: async (b: Blob) => b }));

let tripId = '';

/** 날짜 칸 — 일정이 바뀌면 다시 그려지므로 쓸 때마다 새로 찾는다 */
const region = (name: string) => screen.getByRole('region', { name });
beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  // 서울 기준 2026-10-25 10:00 (여행 2일차)
  vi.setSystemTime(new Date('2026-10-25T01:00:00Z'));
  const trip = await tripRepo.create({
    title: '부산 여행',
    destinations: [{ name: '부산', kind: 'city', countryCode: 'KR' }],
    startDate: '2026-10-24',
    endDate: '2026-10-27',
    timezone: 'Asia/Seoul',
    cover: { emoji: '🌊' },
  });
  tripId = trip.id;
});

afterEach(() => {
  vi.useRealTimers();
});

function renderAt(entries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries: entries });
  render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  return router;
}

describe('예약', () => {
  it('종류마다 필요한 칸만: 항공은 수하물, 렌터카는 반납·보험·결제·무료 취소 (2026-10-28)', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '+ 더 입력하기' }));
    // 항공: 수하물 있음, 취소 마감·결제·바우처 없음
    expect(within(sheet).getByLabelText('기내 수하물')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('위탁 수하물')).toBeInTheDocument();
    expect(within(sheet).queryByLabelText('무료 취소 마감일')).toBeNull();
    expect(within(sheet).queryByLabelText('바우처·확인서 링크')).toBeNull();
    // 음식점: 새 칸 없음
    await user.click(within(sheet).getByRole('button', { name: '음식점' }));
    expect(within(sheet).queryByLabelText('위탁 수하물')).toBeNull();
    expect(within(sheet).queryByLabelText('무료 취소 마감일')).toBeNull();
    expect(within(sheet).queryByRole('group', { name: '결제' })).toBeNull();
    // 렌터카
    await user.click(within(sheet).getByRole('button', { name: '렌터카' }));
    expect(within(sheet).queryByLabelText('위탁 수하물')).toBeNull();
    expect(within(sheet).queryByLabelText('바우처·확인서 링크')).toBeNull();
    // 렌터카는 이름 대신 차종·차량번호 (2026-11-02)
    expect(within(sheet).queryByLabelText('이름')).toBeNull();
    await user.type(within(sheet).getByLabelText('차종'), '아쿠아');
    await user.type(within(sheet).getByLabelText('차량번호'), '12가3456');
    await user.type(within(sheet).getByLabelText('인수 장소'), '김해공항');
    fireEvent.change(within(sheet).getByLabelText('반납 날짜'), {
      target: { value: '2026-10-27' },
    });
    await user.type(within(sheet).getByLabelText('반납 장소'), '부산역');
    await user.type(within(sheet).getByLabelText('보험'), '완전자차');
    fireEvent.change(within(sheet).getByLabelText('무료 취소 마감일'), {
      target: { value: '2026-10-23' },
    });
    await user.click(within(sheet).getByRole('button', { name: '현장 결제' }));
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));

    const card = await screen.findByRole('button', { name: '아쿠아 12가3456 편집' });
    expect(card).toHaveTextContent(/반납 10\.27.*부산역/);
    expect(card).toHaveTextContent('완전자차');
    expect(card).toHaveTextContent('현장 결제');
    // 마감(10.23)이 지났다 (오늘 10.25)
    expect(card).toHaveTextContent('무료 취소 기간 지남');
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved?.end).toMatchObject({ date: '2026-10-27', place: '부산역' });
    expect(saved?.details).toMatchObject({
      carModel: '아쿠아',
      plate: '12가3456',
      insurance: '완전자차',
      payment: 'onsite',
      cancelBy: '2026-10-23',
    });
    expect(saved?.details?.baggage).toBeUndefined();
  });

  it('투어: 만나는 곳·인원·바우처 링크, 바우처는 https만', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '투어' }));
    await user.type(within(sheet).getByLabelText('이름'), '감천마을 투어');
    await user.type(within(sheet).getByLabelText('만나는 곳'), '토성역 6번 출구');
    await user.type(within(sheet).getByLabelText('인원'), '2');
    await user.click(within(sheet).getByRole('button', { name: '+ 더 입력하기' }));
    await user.type(within(sheet).getByLabelText('바우처·확인서 링크'), 'http://x.example');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('링크는 https://로 시작해야 해요')).toBeInTheDocument();
    await user.clear(within(sheet).getByLabelText('바우처·확인서 링크'));
    await user.type(within(sheet).getByLabelText('바우처·확인서 링크'), 'https://x.example/v');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));

    const card = await screen.findByRole('button', { name: '감천마을 투어 편집' });
    expect(card).toHaveTextContent('토성역 6번 출구');
    expect(card).toHaveTextContent('2명');
    expect(screen.getByRole('link', { name: '바우처 열기' })).toHaveAttribute(
      'href',
      'https://x.example/v',
    );
  });

  it('공항은 도시·공항 이름으로 찾아 고르고, 출발·도착 터미널을 따로 넣는다 · 시간은 숫자로 친다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('편명'), 'KE723');
    await user.type(within(sheet).getByLabelText('출발 공항'), '인천');
    await user.click(await within(sheet).findByRole('option', { name: /ICN.*인천국제공항/ }));
    await user.type(within(sheet).getByLabelText('도착 공항'), '간사이');
    await user.click(await within(sheet).findByRole('option', { name: /KIX/ }));
    await user.type(within(sheet).getByLabelText('출발 터미널'), 'T2');
    await user.type(within(sheet).getByLabelText('도착 터미널'), 'T1');
    await user.type(within(sheet).getByLabelText('출발 시간'), '0905');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('예약을 추가했어요')).toBeInTheDocument();
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      start: { place: 'ICN', time: '09:05' },
      end: { place: 'KIX' },
      details: { terminal: 'T2', arrivalTerminal: 'T1' },
    });
  });

  it('항공권을 추가하면 탑승권 카드로 보이고 예약번호를 복사한다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('항공사'), '대한항공');
    await user.type(within(sheet).getByLabelText('편명'), 'ke703');
    await user.type(within(sheet).getByLabelText('출발 공항'), 'icn');
    await user.type(within(sheet).getByLabelText('도착 공항'), 'nrt');
    await user.type(within(sheet).getByLabelText('출발 시간'), '09:10');
    await user.type(within(sheet).getByLabelText('예약번호'), 'AB12CD');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));

    expect(await screen.findByText('예약을 추가했어요')).toBeInTheDocument();
    const group = await screen.findByRole('region', { name: '항공' });
    expect(group).toHaveTextContent('대한항공 KE703');
    expect(group).toHaveTextContent('ICN');
    expect(group).toHaveTextContent('NRT');
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved?.title).toBe('KE703 ICN→NRT');

    await user.click(within(group).getByRole('button', { name: '예약번호 AB12CD 복사' }));
    expect(await screen.findByText('예약번호를 복사했어요')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('AB12CD');
  });

  it('음식점 예약: 인원과 함께 저장되고 그날 일정에 줄로 보인다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`, `/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '음식점' }));
    await user.type(within(sheet).getByLabelText('음식점 이름'), '해운대 암소갈비');
    fireEvent.change(within(sheet).getByLabelText('날짜'), { target: { value: '2026-10-25' } });
    // 새 음식점은 12:00으로 채워져 있다 (2026-11-04)
    expect(within(sheet).getByLabelText('시간')).toHaveValue('12:00');
    await user.clear(within(sheet).getByLabelText('시간'));
    await user.type(within(sheet).getByLabelText('시간'), '19:00');
    await user.type(within(sheet).getByLabelText('인원'), '4');
    await user.type(within(sheet).getByLabelText('예약번호'), 'R-55');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));

    const group = await screen.findByRole('region', { name: '음식점' });
    expect(group).toHaveTextContent('해운대 암소갈비');
    expect(group).toHaveTextContent('4명');
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      kind: 'restaurant',
      details: { partySize: 4 },
      start: { time: '19:00' },
    });

    // 일정 화면 2일차에 예약 줄
    await user.click(screen.getByRole('link', { name: '일정' }));
    // 날짜 칸은 예약이 일정표에 들어가며 새로 그려질 수 있다 → 기다릴 때마다 다시 찾는다
    await waitFor(() =>
      expect(
        within(region('2일차 · 10.25 (일)')).getByRole('button', {
          name: '해운대 암소갈비 예약 보기',
        }),
      ).toBeInTheDocument(),
    );
    const line = within(region('2일차 · 10.25 (일)')).getByRole('button', {
      name: '해운대 암소갈비 예약 보기',
    });
    expect(line).toHaveTextContent('19:00');
    expect(line).toHaveTextContent('R-55');
  });

  it('예약은 일정표에 처음 한 번 시각 순 자리에 들어간다 · 밤 비행기는 도착 공항이 다음 날에', async () => {
    const early = await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'place',
      title: '오전 산책',
      startTime: '10:00',
    });
    const late = await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'food',
      title: '야식',
      startTime: '23:30',
    });
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE123 PUS→BKK',
      start: { date: '2026-10-24', time: '22:30', place: 'PUS' },
      end: { date: '2026-10-25', time: '02:10', place: 'BKK' },
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    await waitFor(async () => expect(await itemRepo.listByTrip(tripId)).toHaveLength(4));
    const items = await itemRepo.listByTrip(tripId);
    expect(items.map((i) => [i.date, i.startTime, i.title])).toEqual([
      ['2026-10-24', '10:00', early.title],
      ['2026-10-24', '22:30', 'KE123 PUS→BKK'],
      ['2026-10-24', '23:30', late.title],
      ['2026-10-25', '02:10', '수완나품국제공항 도착'],
    ]);
    // 공항이 지도에 보이도록 좌표
    expect(items[1]?.place?.coords).toBeDefined();
    expect(items[3]?.place?.coords).toBeDefined();
    // 일정으로 들어간 예약은 위쪽 예약 줄에서 빠진다
    await waitFor(() =>
      expect(
        within(region('1일차 · 10.24 (토)')).queryByRole('button', {
          name: 'KE123 PUS→BKK 예약 보기',
        }),
      ).toBeNull(),
    );
    const day1 = region('1일차 · 10.24 (토)');
    // 예약에서 넘어온 일정은 점선 테두리, 출발 일정은 예약 탭과 같은 탑승권 모양
    const flight = within(day1).getByRole('button', { name: /KE123 PUS→BKK/ });
    expect(flight).toHaveAttribute('data-from-booking');
    expect(flight).toHaveClass('border-dashed');
    expect(within(flight).getByText('PUS')).toBeInTheDocument();
    expect(within(flight).getByText('BKK')).toBeInTheDocument();
    const day2 = screen.getByRole('region', { name: '2일차 · 10.25 (일)' });
    // 오늘이 2일차면 지난 일정은 접혀 있다 — 펼쳐서 본다 (2026-11-10)
    const fold = within(day2).queryByRole('button', { name: /^지난 일정 \d+$/ });
    if (fold) await userEvent.setup().click(fold);
    expect(within(day2).getByRole('button', { name: /수완나품국제공항 도착/ })).toHaveClass(
      'border-dashed',
    );
    expect(within(day1).getByRole('button', { name: /오전 산책/ })).not.toHaveClass(
      'border-dashed',
    );
    // 옮기거나 지워도 다시 넣지 않는다
    expect((await bookingRepo.listByTrip(tripId))[0]?.plannedAt).toBeDefined();
  });

  it('일정표의 메모는 이름 없이 내용만 보인다', async () => {
    await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'note',
      title: '환전',
      memo: '공항에서 환전하기\n현금 조금만',
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.24 (토)' });
    expect(await within(day1).findByText(/공항에서 환전하기/)).toBeInTheDocument();
    expect(within(day1).queryByText('환전')).toBeNull();
  });

  it('숙소: 체크아웃이 체크인보다 빠르면 저장하지 않는다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '숙소' }));
    await user.type(within(sheet).getByLabelText('숙소 이름'), '해운대 호텔');
    // 날짜 칸은 타이핑 대신 값을 직접 넣는다 (jsdom)
    fireEvent.change(within(sheet).getByLabelText('체크아웃'), { target: { value: '2026-10-24' } });
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('체크아웃은 체크인 다음 날 이후여야 해요')).toBeInTheDocument();
    expect(await bookingRepo.listByTrip(tripId)).toHaveLength(0);
  });

  it('숙소는 일정 화면 각 날 아래에 몇 번째 밤인지와 함께 보인다', async () => {
    await bookingRepo.create({
      tripId,
      kind: 'lodging',
      title: '해운대 호텔',
      start: { date: '2026-10-24', time: '15:00' },
      end: { date: '2026-10-26' },
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    await waitFor(() =>
      expect(
        within(region('1일차 · 10.24 (토)')).getByRole('button', {
          name: /해운대 호텔, 1번째 밤 숙소/,
        }),
      ).toHaveTextContent('1/2'),
    );
    const day2 = screen.getByRole('region', { name: '2일차 · 10.25 (일)' });
    expect(within(day2).getByRole('button', { name: /2번째 밤/ })).toBeInTheDocument();
    // 체크아웃 날(3일차)에는 없다
    const day3 = screen.getByRole('region', { name: '3일차 · 10.26 (월)' });
    expect(within(day3).queryByRole('button', { name: /밤 숙소/ })).not.toBeInTheDocument();
  });

  it('숙소 줄을 누르면 다른 장소처럼 상세: 시간·조식·길찾기(국내는 네이버·카카오) (사용자 요청 2026-10-26)', async () => {
    await bookingRepo.create({
      tripId,
      kind: 'lodging',
      title: '해운대 호텔',
      start: { date: '2026-10-24', time: '15:00' },
      end: { date: '2026-10-26' },
      details: { address: '부산 해운대구' },
    });
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/plan?day=all`]);
    await waitFor(async () => expect(await itemRepo.listByTrip(tripId)).toHaveLength(1));
    await waitFor(() =>
      expect(
        within(region('2일차 · 10.25 (일)')).getByRole('button', { name: /2번째 밤 숙소/ }),
      ).toBeInTheDocument(),
    );
    await user.click(
      within(region('2일차 · 10.25 (일)')).getByRole('button', { name: /2번째 밤 숙소/ }),
    );
    const sheet = await screen.findByRole('dialog', { name: '해운대 호텔' });
    expect(within(sheet).getByLabelText('방문 시간')).toHaveValue('15:00');
    expect(within(sheet).getByText('조식 없음')).toBeInTheDocument();
    const dir = within(sheet).getByRole('region', { name: '길찾기' });
    expect(within(dir).getByRole('link', { name: '네이버 지도로 열기' })).toBeInTheDocument();
    expect(within(dir).getByRole('link', { name: '카카오맵로 열기' })).toBeInTheDocument();
    expect(within(dir).queryByRole('link', { name: /Google/ })).toBeNull();
    expect(within(sheet).getByRole('button', { name: /후기/ })).toBeInTheDocument();
  });

  it('편집에서 삭제하고 실행 취소한다', async () => {
    const user = userEvent.setup();
    await bookingRepo.create({
      tripId,
      kind: 'tour',
      title: '감천 투어',
      start: { date: '2026-10-25' },
    });
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '감천 투어 편집' }));
    await user.click(screen.getByRole('button', { name: '예약 삭제' }));
    await acceptDelete(user);
    expect(await screen.findByText('예약을 삭제했어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByRole('button', { name: '감천 투어 편집' })).toBeInTheDocument();
  });
});

describe('홈', () => {
  it('여행 중: 다음 일정과 남은 시간, 오늘 숙소를 보여준다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({
      tripId,
      date: '2026-10-25',
      kind: 'place',
      title: '감천문화마을',
      startTime: '08:00',
      endTime: '09:00',
    });
    await itemRepo.create({
      tripId,
      date: '2026-10-25',
      kind: 'food',
      title: '돼지국밥',
      startTime: '10:35',
    });
    await bookingRepo.create({
      tripId,
      kind: 'lodging',
      title: '해운대 호텔',
      start: { date: '2026-10-24' },
      end: { date: '2026-10-27' },
      confirmationNo: 'H-7788',
    });
    renderAt(['/']);

    // 맨 위 여행 카드는 목록 카드 모양 + 여행 중 민트 바탕, 날씨 바로가기도 (사용자 요청 2026-11-23).
    // 준비 현황은 여행 중이라 접혀 있다 (docs/29 §7.1)
    const cardLinks = await screen.findAllByRole('link', { name: /부산 여행/ });
    const plan = cardLinks.find((a) => a.getAttribute('href')?.endsWith('/plan'))!;
    expect(plan.parentElement).toHaveClass('bg-mint');
    expect(cardLinks.some((a) => a.getAttribute('href')?.endsWith('/weather'))).toBe(true);
    const prep = await screen.findByRole('button', { expanded: false, name: /준비/ });
    expect(prep).toBeInTheDocument();
    const next = await screen.findByRole('region', { name: '다음 일정' });
    expect(next).toHaveTextContent('돼지국밥');
    // 여행 모드처럼 출발까지 남은 시간 (2026-11-13)
    expect(next).toHaveTextContent(/(\d+시간 )?\d+분( \d+초)?\s*후 출발/);
    const lodging = screen.getByRole('region', { name: '오늘 숙소' });
    expect(lodging).toHaveTextContent('해운대 호텔');
    expect(lodging).toHaveTextContent('2/3');

    // 끝난 일정은 "지난 일정 N"으로 접혀 있다 (사용자 결정 2026-11-10) → 펼치면 오른쪽 [미방문][방문] (2026-11-06)
    expect(screen.queryByRole('group', { name: '감천문화마을 방문 기록' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /지난 일정 1/ }));
    const visits = screen.getByRole('group', { name: '감천문화마을 방문 기록' });
    await user.click(within(visits).getByRole('button', { name: '방문' }));
    await waitFor(async () =>
      expect((await itemRepo.listByTrip(tripId))[0]).toMatchObject({
        visit: 'visited',
        done: true,
      }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('group', { name: '감천문화마을 방문 기록' })).getByRole('button', {
          name: '방문',
        }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    // 아직인 돼지국밥에는 버튼이 없다
    expect(screen.queryByRole('group', { name: '돼지국밥 방문 기록' })).toBeNull();
  });

  it('여행 전에는 D-day 카드를 보여준다', async () => {
    vi.setSystemTime(new Date('2026-10-21T01:00:00Z'));
    renderAt(['/']);
    expect(await screen.findByText('D-3')).toBeInTheDocument();
    expect(screen.getByText('부산 여행')).toBeInTheDocument();
  });
});

describe('빠른 메뉴 바로가기', () => {
  it('예약번호를 모아 보고 복사한다', async () => {
    const user = userEvent.setup();
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE1001 GMP→PUS',
      start: { date: '2026-10-24' },
      confirmationNo: 'QW77',
    });
    renderAt([`/trips/${tripId}/plan`]);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(screen.getByRole('button', { name: '예약번호' }));
    const sheet = await screen.findByRole('dialog', { name: '예약번호' });
    await user.click(within(sheet).getByRole('button', { name: /KE1001/ }));
    expect(await navigator.clipboard.readText()).toBe('QW77');
  });

  it('숙소 예약이 없으면 알려준다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/plan`]);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(screen.getByRole('button', { name: '숙소로 길찾기' }));
    expect(await screen.findByText('숙소 예약이 없어요')).toBeInTheDocument();
  });
});

it('인천 출발 터미널이 비면 인천공항 운항 정보로 채운다 (2026-11-24)', async () => {
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    if (url.startsWith('/api/flights/KE703/airport'))
      return Response.json({
        checkedAt: '2026-10-25T00:00:00.000Z',
        dep: { info: { airport: 'ICN', terminal: 'T2' } },
        arr: null,
      });
    if (url === '/api/flights/KE703')
      return Response.json({
        flightNo: 'KE703',
        from: { iata: 'ICN', time: '09:00' },
        to: { iata: 'NRT', terminal: '1', time: '11:20' },
      });
    return Response.json({}, { status: 404 });
  });
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('편명'), 'KE703');
    await user.click(within(sheet).getByRole('button', { name: '불러오기' }));
    await waitFor(() => expect(within(sheet).getByLabelText('출발 터미널')).toHaveValue('T2'));
    expect(within(sheet).getByLabelText('도착 터미널')).toHaveValue('T1');
    expect(urls.find((u) => u.includes('/airport'))).toMatch(/from=ICN/);
  } finally {
    vi.unstubAllGlobals();
    useAuth.setState({ status: 'unknown', me: null });
  }
});

describe('편명으로 불러오기', () => {
  it('공항·터미널·시간을 채우고 "최근 운항 기준" 안내 (밤 비행이면 도착은 다음 날)', async () => {
    const { useAuth } = await import('../../data/authStore');
    useAuth.setState({
      status: 'user',
      me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
    });
    vi.stubGlobal('fetch', async (url: string) =>
      url.startsWith('/api/flights/')
        ? Response.json({
            flightNo: 'KE001',
            airline: 'Korean Air',
            from: { iata: 'ICN', terminal: '2', time: '20:30' },
            to: { iata: 'HNL', terminal: '1', time: '10:10' },
          })
        : Response.json({}, { status: 404 }),
    );
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('편명'), 'ke001');
    await user.click(within(sheet).getByRole('button', { name: '불러오기' }));
    expect(await within(sheet).findByRole('status')).toHaveTextContent('최근 운항 기준');
    expect(within(sheet).getByLabelText('출발 공항')).toHaveValue('ICN');
    expect(within(sheet).getByLabelText('도착 공항')).toHaveValue('HNL');
    expect(within(sheet).getByLabelText('출발 터미널')).toHaveValue('T2');
    expect(within(sheet).getByLabelText('출발 시간')).toHaveValue('20:30');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    expect(await screen.findByText('예약을 추가했어요')).toBeInTheDocument();
    const [saved] = await bookingRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      provider: 'Korean Air',
      start: { place: 'ICN', time: '20:30' },
      end: { place: 'HNL', time: '10:10' },
    });
    expect(saved!.end!.date > saved!.start.date).toBe(true);
    vi.unstubAllGlobals();
    useAuth.setState({ status: 'unknown', me: null });
  });

  it('출발 날짜는 도착 날짜처럼 고칠 수 있고, 위 점선 칸과 같은 값 (2026-11-24)', async () => {
    renderAt([`/trips/${tripId}/bookings`]);
    await userEvent.setup().click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    const [top, row] = within(sheet).getAllByLabelText('출발 날짜');
    expect(row).toHaveAttribute('type', 'date');
    fireEvent.change(row!, { target: { value: '2026-10-25' } });
    expect(top).toHaveValue('2026-10-25');
    fireEvent.change(top!, { target: { value: '2026-10-26' } });
    expect(row).toHaveValue('2026-10-26');
  });

  it('수하물은 기내·위탁 따로, 좌석과 한 줄 — 저장은 "위탁 23kg · 기내 7kg", 고칠 때 다시 나뉜다 (2026-11-24)', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await userEvent.setup().click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.type(within(sheet).getByLabelText('편명'), 'KE703');
    await user.click(within(sheet).getByRole('button', { name: '+ 더 입력하기' }));
    await user.type(within(sheet).getByLabelText('좌석'), '32A');
    // 빈 칸은 그 항공사(대한항공) 대표 무게가 회색 참고값으로
    expect(within(sheet).getByLabelText('기내 수하물')).toHaveAttribute('placeholder', '10kg');
    expect(within(sheet).getByLabelText('위탁 수하물')).toHaveAttribute('placeholder', '23kg');
    await user.type(within(sheet).getByLabelText('기내 수하물'), '7');
    await user.type(within(sheet).getByLabelText('위탁 수하물'), '23');
    // 칸을 떠나면 kg가 붙는다
    expect(within(sheet).getByLabelText('기내 수하물')).toHaveValue('7kg');
    await user.tab();
    expect(within(sheet).getByLabelText('위탁 수하물')).toHaveValue('23kg');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    await waitFor(async () => expect(await bookingRepo.listByTrip(tripId)).toHaveLength(1));
    const [b] = await bookingRepo.listByTrip(tripId);
    expect(b?.details).toMatchObject({ seat: '32A', baggage: '위탁 23kg · 기내 7kg' });
    const group = await screen.findByRole('region', { name: '항공' });
    await user.click(within(group).getAllByRole('button', { name: /편집/ })[0]!);
    const edit = await screen.findByRole('dialog', { name: '예약 편집' });
    expect(within(edit).getByLabelText('기내 수하물')).toHaveValue('7kg');
    expect(within(edit).getByLabelText('위탁 수하물')).toHaveValue('23kg');
  });
});

it('해외 식당: 예약 시각이 Google 영업시간 밖이면 알린다 (2026-11-24)', async () => {
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const id = 'ChIJ_dinner_abcdef';
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/places/search')
      return Response.json({
        places: [
          { source: 'google', id, name: '저녁 식당', address: '도쿄', coords: { lat: 1, lng: 1 } },
        ],
      });
    if (url === `/api/places/google/${id}`)
      return Response.json({
        phone: '03-1111-2222',
        periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '17:00', close: '23:00' })),
      });
    return Response.json({}, { status: 404 });
  });
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '음식점' }));
    await user.type(within(sheet).getByLabelText('음식점 이름'), '저녁 식당');
    await user.click(await within(sheet).findByRole('option', { name: /저녁 식당/ }));
    // 새 음식점은 12:00 — 17시에 여는 곳
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      '12:00은 영업시간이 아닐 수 있어요',
    );
    expect(within(sheet).getByLabelText('연락처')).toHaveValue('03-1111-2222');
    fireEvent.change(within(sheet).getByLabelText('시간'), { target: { value: '18:00' } });
    await waitFor(() => expect(within(sheet).queryByRole('alert')).toBeNull());
  } finally {
    vi.unstubAllGlobals();
    useAuth.setState({ status: 'unknown', me: null });
  }
});

it('예약번호는 항공사 오른쪽에 (2026-11-24)', async () => {
  renderAt([`/trips/${tripId}/bookings`]);
  await userEvent.setup().click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  const provider = within(sheet).getByLabelText('항공사');
  const no = within(sheet).getByLabelText('예약번호');
  expect(provider.closest('.grid')).toBe(no.closest('.grid'));
  expect(within(sheet).getAllByLabelText('예약번호')).toHaveLength(1);
});

it('해외 숙소를 고르면 확인된 전화번호를 빈 칸에 채운다 (2026-11-24)', async () => {
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const id = 'ChIJ_hotel_abcdef';
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/places/search')
      return Response.json({
        places: [
          {
            source: 'google',
            id,
            name: '호텔 그레이스리',
            address: '도쿄 신주쿠',
            coords: { lat: 35.69, lng: 139.7 },
          },
        ],
      });
    if (url === `/api/places/google/${id}`) return Response.json({ phone: '03-6833-2489' });
    return Response.json({}, { status: 404 });
  });
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '숙소' }));
    await user.type(within(sheet).getByLabelText('숙소 이름'), '그레이스리');
    await user.click(await within(sheet).findByRole('option', { name: /호텔 그레이스리/ }));
    await waitFor(() => expect(within(sheet).getByLabelText('연락처')).toHaveValue('03-6833-2489'));
  } finally {
    vi.unstubAllGlobals();
    useAuth.setState({ status: 'unknown', me: null });
  }
});

it('드랍: 숙소 → 공항을 고르면 차로 가는 시간으로 추천 출발 시각 (2026-11-24)', async () => {
  await bookingRepo.create({
    tripId,
    kind: 'flight',
    title: 'KE124',
    start: { date: '2026-10-27', time: '12:35', place: 'PUS' },
    end: { date: '2026-10-27', time: '13:40', place: 'GMP' },
    details: { flightNo: 'KE124' },
  });
  await bookingRepo.create({
    tripId,
    kind: 'lodging',
    title: '해운대 그랜드호텔',
    start: { date: '2026-10-24', coords: { lat: 35.16, lng: 129.16 } },
    end: { date: '2026-10-27' },
  });
  vi.stubGlobal('fetch', async (url: string) =>
    url === '/api/routes/eta'
      ? Response.json({ drive: 52, driveKm: 30, source: 'google' })
      : Response.json({}, { status: 404 }),
  );
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '픽업·드랍' }));
    await user.click(within(sheet).getByRole('button', { name: /^드랍/ }));
    const [fromChips, toChips] = await within(sheet).findAllByRole('group', {
      name: '예약한 공항·숙소에서 고르기',
    });
    await user.click(within(fromChips!).getByRole('button', { name: '해운대 그랜드호텔' }));
    await user.click(within(toChips!).getByRole('button', { name: /김해/ }));
    // 국내선: 12:35 − 52분 − 1시간 → 10:40
    expect(await within(sheet).findByText('추천 출발 10:40')).toBeInTheDocument();
    expect(within(sheet).getByText('차로 52분 · 이륙 1시간 전 도착')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: '넣기' }));
    expect(within(sheet).getByLabelText('시간')).toHaveValue('10:40');
  } finally {
    vi.unstubAllGlobals();
  }
});

describe('픽업·드랍 예약 (사용자 요청 2026-10-25)', () => {
  it('예약한 공항·숙소 칩: 공항을 고르면 편명·날짜도, 좌표까지 저장 (2026-11-24)', async () => {
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE123',
      start: { date: '2026-10-25', place: 'ICN' },
      end: { date: '2026-10-25', place: 'PUS' },
      details: { flightNo: 'KE123' },
    });
    await bookingRepo.create({
      tripId,
      kind: 'lodging',
      title: '해운대 그랜드호텔',
      start: { date: '2026-10-25', coords: { lat: 35.16, lng: 129.16 } },
      end: { date: '2026-10-27' },
    });
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '픽업·드랍' }));
    const [fromChips, toChips] = await within(sheet).findAllByRole('group', {
      name: '예약한 공항·숙소에서 고르기',
    });
    await user.click(within(fromChips!).getByRole('button', { name: /김해/ }));
    await user.click(within(toChips!).getByRole('button', { name: '해운대 그랜드호텔' }));
    expect(within(sheet).getByLabelText('편명 (선택)')).toHaveValue('KE123');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    await waitFor(async () => expect(await bookingRepo.listByTrip(tripId)).toHaveLength(3));
    const b = (await bookingRepo.listByTrip(tripId)).find((x) => x.kind === 'transfer');
    expect(b?.start).toMatchObject({ date: '2026-10-25', place: expect.stringMatching(/김해/) });
    expect(b?.start.coords).toBeDefined();
    expect(b?.end).toMatchObject({ coords: { lat: 35.16, lng: 129.16 } });
    expect(b?.details?.flightNo).toBe('KE123');
  });

  it('예약 사이트·날짜·시간·인원·타는 곳·내리는 곳·편명 → 이름을 비우면 "공항 픽업"', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: '픽업·드랍' }));
    await user.click(within(sheet).getByRole('button', { name: 'KKday' }));
    expect(within(sheet).getByLabelText('예약 사이트')).toHaveValue('KKday');
    await user.type(within(sheet).getByLabelText('시간'), '1030');
    await user.type(within(sheet).getByLabelText('타는 곳'), '김해공항');
    await user.type(within(sheet).getByLabelText('내리는 곳'), '해운대 호텔');
    await user.type(within(sheet).getByLabelText('인원'), '3');
    await user.type(within(sheet).getByLabelText('편명 (선택)'), 'ke123');
    await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
    await waitFor(async () => expect(await bookingRepo.listByTrip(tripId)).toHaveLength(1));
    const [b] = await bookingRepo.listByTrip(tripId);
    expect(b).toMatchObject({
      kind: 'transfer',
      title: '공항 픽업',
      provider: 'KKday',
      start: { date: '2026-10-24', time: '10:30', place: '김해공항' },
      end: { place: '해운대 호텔' },
      details: { direction: 'pickup', partySize: 3, flightNo: 'KE123' },
    });
  });

  it('타는 곳·내리는 곳도 장소 검색으로 고른다 (사용자 요청 2026-10-26)', async () => {
    useAuth.setState({
      status: 'user',
      me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
    });
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url === '/api/places/search') {
        const q = JSON.parse(String(init?.body)).q as string;
        return Response.json({
          places: [
            q.includes('김해')
              ? { source: 'naver', id: 'n1', name: '김해국제공항', address: '부산 강서구' }
              : { source: 'naver', id: 'n2', name: '해운대 그랜드호텔', address: '부산 해운대구' },
          ],
        });
      }
      return Response.json({}, { status: 404 });
    });
    try {
      const user = userEvent.setup();
      renderAt([`/trips/${tripId}/bookings`]);
      await user.click(await screen.findByRole('button', { name: '예약 추가' }));
      const sheet = screen.getByRole('dialog', { name: '예약 추가' });
      await user.click(within(sheet).getByRole('button', { name: '픽업·드랍' }));
      await user.type(within(sheet).getByLabelText('타는 곳'), '김해');
      await user.click(await within(sheet).findByRole('option', { name: /김해국제공항/ }));
      expect(within(sheet).getByLabelText('타는 곳')).toHaveValue('김해국제공항');
      await user.type(within(sheet).getByLabelText('내리는 곳'), '해운대');
      await user.click(await within(sheet).findByRole('option', { name: /해운대 그랜드호텔/ }));
      expect(within(sheet).getByLabelText('내리는 곳')).toHaveValue('해운대 그랜드호텔');
    } finally {
      vi.unstubAllGlobals();
      useAuth.setState({ status: 'unknown', me: null });
    }
  });
});

it('숙소: 달력에서 체크인 → 체크아웃 순서로 눌러 한 번에, 여행 기간은 따로 표시', async () => {
  const user = userEvent.setup();
  renderAt([`/trips/${tripId}/bookings`]);
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  await user.click(within(sheet).getByRole('button', { name: '숙소' }));
  await user.click(within(sheet).getByRole('button', { name: /달력에서 고르기/ }));
  const cal = await screen.findByRole('dialog', { name: '체크인·체크아웃' });
  expect(within(cal).getByText('여행', { selector: '*' })).toBeInTheDocument();
  await user.click(within(cal).getByRole('button', { name: /^10\.25 \(일\)/ }));
  expect(within(cal).getByRole('button', { name: '체크아웃 날을 눌러 주세요' })).toBeDisabled();
  await user.click(within(cal).getByRole('button', { name: /^10\.27 \(화\)/ }));
  await user.click(
    within(cal).getByRole('button', { name: /10\.25 \(일\) → 10\.27 \(화\) · 2박으로 하기/ }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '체크인·체크아웃' })).not.toBeInTheDocument(),
  );
  expect(within(sheet).getByLabelText('체크인')).toHaveValue('2026-10-25');
  expect(within(sheet).getByLabelText('체크아웃')).toHaveValue('2026-10-27');
});

it('덜 쓰는 칸(좌석·예약처·결제 메모·메모)은 [더 입력하기]로 펼친다 (docs/20 U4)', async () => {
  const user = userEvent.setup();
  renderAt([`/trips/${tripId}/bookings`]);
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  expect(within(sheet).queryByLabelText('좌석')).not.toBeInTheDocument();
  expect(within(sheet).queryByLabelText('메모')).not.toBeInTheDocument();
  await user.click(within(sheet).getByRole('button', { name: /더 입력하기/ }));
  expect(within(sheet).getByLabelText('좌석')).toBeInTheDocument();
  expect(within(sheet).getByLabelText('메모')).toBeInTheDocument();
});

it('숙소: 조식 포함 → 날짜별로 빼고, 일정 화면 그날 아침에 조식 표시 (사용자 요청 2026-10-26)', async () => {
  const user = userEvent.setup();
  renderAt([`/trips/${tripId}/bookings`]);
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  await user.click(within(sheet).getByRole('button', { name: '숙소' }));
  await user.type(within(sheet).getByLabelText('숙소 이름'), '해운대 호텔');
  fireEvent.change(within(sheet).getByLabelText('체크인'), { target: { value: '2026-10-24' } });
  fireEvent.change(within(sheet).getByLabelText('체크아웃'), { target: { value: '2026-10-27' } });
  await user.click(within(sheet).getByRole('switch', { name: '조식 포함' }));
  const days = within(sheet).getByRole('group', { name: '조식 있는 날' });
  expect(within(days).getAllByRole('button')).toHaveLength(3); // 25·26·27일 아침
  await user.click(within(days).getByRole('button', { name: /10\.26/ }));
  await user.click(within(sheet).getByRole('button', { name: '예약 추가' }));
  await waitFor(async () => expect(await bookingRepo.listByTrip(tripId)).toHaveLength(1));
  const [b] = await bookingRepo.listByTrip(tripId);
  expect(b?.details).toMatchObject({
    breakfast: true,
    breakfastDates: ['2026-10-25', '2026-10-27'],
  });
});

describe('예약처 (2026-10-27)', () => {
  it('공항 픽업은 일정에서 제목 옆에 (예약처)', async () => {
    await bookingRepo.create({
      tripId,
      kind: 'transfer',
      title: '공항 픽업',
      provider: 'KKday',
      details: { direction: 'pickup' },
      start: { date: '2026-10-24', time: '12:00' },
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    await waitFor(() =>
      expect(within(region('1일차 · 10.24 (토)')).getByText('(KKday)')).toBeInTheDocument(),
    );
  });

  it('투어·티켓 등은 [더 입력하기] 없이 예약처 칸이 보인다', async () => {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = await screen.findByRole('dialog', { name: '예약 추가' });
    await user.click(within(sheet).getByRole('button', { name: /투어/ }));
    expect(within(sheet).getByLabelText('예약처')).toBeInTheDocument();
  });
});

it('사진으로 채우기: 읽은 글에서 예약번호·편명·공항·날짜·시각을 빈 칸에 (2026-11-24)', async () => {
  vi.stubGlobal('fetch', async (url: string) =>
    url === '/api/ocr'
      ? Response.json({
          text: '예약번호: AB12CD\nKE 703 ICN → NRT\n2026년 10월 25일 09:00 출발 11:20 도착',
          source: 'google',
        })
      : Response.json({}, { status: 404 }),
  );
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.jpg', { type: 'image/jpeg' });
    await user.upload(within(sheet).getByLabelText('사진으로 예약 정보 자동 채우기'), file);
    await waitFor(() => expect(within(sheet).getByLabelText('예약번호')).toHaveValue('AB12CD'));
    expect(within(sheet).getByLabelText('편명')).toHaveValue('KE703');
    expect(within(sheet).getByLabelText('출발 공항')).toHaveValue('ICN');
    expect(within(sheet).getByLabelText('출발 시간')).toHaveValue('09:00');
    expect(await screen.findByText(/캡처에서 \d+칸을 채웠어요/)).toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('사진으로 채우기: 항공 탭에서 숙소 사진을 고르면 숙소로 바꿔 채운다 (2026-11-24)', async () => {
  vi.stubGlobal('fetch', async (url: string) =>
    url === '/api/ocr'
      ? Response.json({
          text: [
            'Hotel Nikko Kansai Airport',
            '예약 번호: 4821.553.190',
            '체크인            체크아웃',
            '2026년 10월 25일 (일)   2026년 10월 27일 (화)',
            '16:00 이후        10:00 이전',
          ].join('\n'),
          source: 'google',
        })
      : Response.json({}, { status: 404 }),
  );
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    // 버튼은 종류 고르기보다 위에
    const scan = within(sheet).getByRole('button', { name: '사진으로 예약 정보 자동 채우기' });
    const lodgingChip = within(sheet).getByRole('button', { name: '숙소' });
    expect(
      scan.compareDocumentPosition(lodgingChip) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: '항공' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const file = new File([new Uint8Array([1, 2, 3])], 'hotel.jpg', { type: 'image/jpeg' });
    await user.upload(within(sheet).getByLabelText('사진으로 예약 정보 자동 채우기'), file);
    await waitFor(() => expect(lodgingChip).toHaveAttribute('aria-pressed', 'true'));
    expect(within(sheet).getByLabelText('숙소 이름')).toHaveValue('Hotel Nikko Kansai Airport');
    expect(within(sheet).getByLabelText('예약번호')).toHaveValue('4821553190');
    expect(within(sheet).getByLabelText('체크인 시간')).toHaveValue('16:00');
    expect(within(sheet).getByLabelText('체크아웃 시간')).toHaveValue('10:00');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('사진으로 채우기: 탑승권 바코드는 기기 안에서 읽고, 시각은 편명 불러오기로 (2026-11-24)', async () => {
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    if (url === '/api/flights/KE703')
      return Response.json({
        flightNo: 'KE703',
        from: { iata: 'ICN', terminal: '2', time: '09:00' },
        to: { iata: 'NRT', terminal: '1', time: '11:20' },
      });
    return Response.json({}, { status: 404 });
  });
  vi.stubGlobal('createImageBitmap', async () => ({ close() {} }));
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      detect = async () => [
        { rawValue: 'M1HONG/GILDONG MR     EAB12CD ICNNRTKE 0703 307Y034A0045 100' },
      ];
    },
  );
  try {
    const user = userEvent.setup();
    renderAt([`/trips/${tripId}/bookings`]);
    await user.click(await screen.findByRole('button', { name: '예약 추가' }));
    const sheet = screen.getByRole('dialog', { name: '예약 추가' });
    const file = new File([new Uint8Array([1, 2, 3])], 'pass.png', { type: 'image/png' });
    await user.upload(within(sheet).getByLabelText('사진으로 예약 정보 자동 채우기'), file);
    await waitFor(() => expect(within(sheet).getByLabelText('출발 시간')).toHaveValue('09:00'));
    expect(within(sheet).getByLabelText('예약번호')).toHaveValue('AB12CD');
    expect(within(sheet).getByLabelText('편명')).toHaveValue('KE703');
    expect(within(sheet).getByLabelText('도착 시간')).toHaveValue('11:20');
    expect(await screen.findByText(/탑승권 바코드로 \d+칸을 채웠어요/)).toBeInTheDocument();
    // 사진은 글자 인식으로 보내지 않았다
    expect(urls).not.toContain('/api/ocr');
  } finally {
    vi.unstubAllGlobals();
    useAuth.setState({ status: 'unknown', me: null });
  }
});
