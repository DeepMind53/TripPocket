import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let tripId = '';

beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  // 서울 기준 2026-10-25 10:00 (여행 2일차)
  vi.setSystemTime(new Date('2026-10-25T01:00:00Z'));
  const trip = await tripRepo.create({
    title: '부산 여행',
    destinations: ['부산'],
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
    const day2 = await screen.findByRole('region', { name: '2일차 · 10.25 (일)' });
    const line = within(day2).getByRole('button', { name: '해운대 암소갈비 예약 보기' });
    expect(line).toHaveTextContent('19:00');
    expect(line).toHaveTextContent('R-55');
  });

  it('밤 비행기는 출발일과 도착일 일정에 모두 보인다', async () => {
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE123 PUS→BKK',
      start: { date: '2026-10-24', time: '22:30', place: 'PUS' },
      end: { date: '2026-10-25', time: '02:10', place: 'BKK' },
    });
    renderAt([`/trips/${tripId}/plan?day=all`]);
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.24 (토)' });
    expect(within(day1).getByRole('button', { name: 'KE123 PUS→BKK 예약 보기' })).toHaveTextContent(
      'PUS → BKK',
    );
    const day2 = screen.getByRole('region', { name: '2일차 · 10.25 (일)' });
    expect(within(day2).getByRole('button', { name: 'KE123 PUS→BKK 예약 보기' })).toHaveTextContent(
      '도착',
    );
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
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.24 (토)' });
    expect(
      within(day1).getByRole('button', { name: /해운대 호텔, 1번째 밤 숙소/ }),
    ).toHaveTextContent('1/2');
    const day2 = screen.getByRole('region', { name: '2일차 · 10.25 (일)' });
    expect(within(day2).getByRole('button', { name: /2번째 밤/ })).toBeInTheDocument();
    // 체크아웃 날(3일차)에는 없다
    const day3 = screen.getByRole('region', { name: '3일차 · 10.26 (월)' });
    expect(within(day3).queryByRole('button', { name: /밤 숙소/ })).not.toBeInTheDocument();
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
      startTime: '09:00',
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

    const next = await screen.findByRole('region', { name: '다음 일정' });
    expect(next).toHaveTextContent('돼지국밥');
    expect(next).toHaveTextContent('35분 후');
    const lodging = screen.getByRole('region', { name: '오늘 숙소' });
    expect(lodging).toHaveTextContent('해운대 호텔');
    expect(lodging).toHaveTextContent('2/3');

    // 오늘 일정에서 다녀옴 체크
    await user.click(screen.getByRole('checkbox', { name: '감천문화마을' }));
    await waitFor(async () => expect((await itemRepo.listByTrip(tripId))[0]?.done).toBe(true));
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
