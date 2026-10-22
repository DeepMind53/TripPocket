import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let tripId = '';

beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T03:00:00Z')); // 여행 2일 전
  const trip = await tripRepo.create({
    title: '도쿄 가을여행',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    timezone: 'Asia/Tokyo',
    cover: { emoji: '🗼' },
  });
  tripId = trip.id;
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderPlan(search = '') {
  const router = createMemoryRouter(routes, { initialEntries: [`/trips/${tripId}/plan${search}`] });
  render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  await screen.findByRole('toolbar', { name: '날짜 선택' });
  return router;
}

const day = (name: string) => screen.getByRole('region', { name });
// 시트가 닫혀 나머지 화면이 다시 보일 때까지 기다린다
const dayAfterSheet = (name: string) => screen.findByRole('region', { name });

describe('일정 화면', () => {
  it('일차별로 나뉘고, 직접 입력으로 일정을 추가한다', async () => {
    const user = userEvent.setup();
    await renderPlan();
    const day1 = day('1일차 · 10.24 (토)');
    expect(within(day1).getByText('아직 일정이 없어요')).toBeInTheDocument();

    await user.click(within(day1).getByRole('button', { name: '일정 추가' }));
    const sheet = screen.getByRole('dialog', { name: '일정 추가' });
    await user.click(within(sheet).getByRole('button', { name: '맛집' }));
    await user.type(within(sheet).getByLabelText('이름'), '이치란 라멘');
    await user.type(within(sheet).getByLabelText('시작'), '11:30');
    await user.type(within(sheet).getByLabelText('주소'), '신주쿠 3-34-11');
    await user.click(within(sheet).getByRole('button', { name: '일정에 추가' }));

    expect(await screen.findByText('일정을 추가했어요')).toBeInTheDocument();
    const row = within(await dayAfterSheet('1일차 · 10.24 (토)')).getByRole('button', {
      name: '1번째 일정, 이치란 라멘',
    });
    expect(row).toHaveTextContent('11:30');
    expect(row).toHaveTextContent('신주쿠 3-34-11');
    const [saved] = await itemRepo.listByTrip(tripId);
    expect(saved).toMatchObject({
      kind: 'food',
      startTime: '11:30',
      place: { address: '신주쿠 3-34-11' },
    });
  });

  it('이름이 비어 있으면 저장하지 않는다', async () => {
    const user = userEvent.setup();
    await renderPlan();
    await user.click(within(day('1일차 · 10.24 (토)')).getByRole('button', { name: '일정 추가' }));
    await user.click(screen.getByRole('button', { name: '일정에 추가' }));
    expect(await screen.findByText('이름을 입력해 주세요')).toBeInTheDocument();
    expect(await itemRepo.listByTrip(tripId)).toHaveLength(0);
  });

  it('Day 칩으로 하루만 볼 수 있다', async () => {
    const user = userEvent.setup();
    const router = await renderPlan();
    await user.click(screen.getByRole('button', { name: /2일차 10\.25/ }));
    expect(router.state.location.search).toBe('?day=2');
    expect(screen.getByRole('region', { name: '2일차 · 10.25 (일)' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '1일차 · 10.24 (토)' })).not.toBeInTheDocument();
  });

  it('상세에서 삭제하고 실행 취소한다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({ tripId, date: '2026-10-24', kind: 'place', title: '센소지' });
    await renderPlan();
    await user.click(await screen.findByRole('button', { name: '1번째 일정, 센소지' }));
    const sheet = screen.getByRole('dialog', { name: '센소지' });
    await user.click(within(sheet).getByRole('button', { name: '삭제' }));

    expect(await screen.findByText('일정을 삭제했어요')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '1번째 일정, 센소지' })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByRole('button', { name: '1번째 일정, 센소지' })).toBeInTheDocument();
  });

  it('다른 날로 옮긴다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({ tripId, date: '2026-10-24', kind: 'place', title: '센소지' });
    await itemRepo.create({ tripId, date: '2026-10-26', kind: 'food', title: '스시' });
    await renderPlan();
    await user.click(await screen.findByRole('button', { name: '1번째 일정, 센소지' }));
    await user.click(screen.getByRole('button', { name: '다른 날로 이동' }));
    await user.click(screen.getByRole('button', { name: /3일차 · 10\.26 \(월\)/ }));

    expect(await screen.findByText('일정을 옮겼어요')).toBeInTheDocument();
    const day3 = await dayAfterSheet('3일차 · 10.26 (월)');
    expect(within(day3).getByRole('button', { name: '2번째 일정, 센소지' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('같은 날 안에서 위로·아래로 순서를 바꾼다', async () => {
    const user = userEvent.setup();
    for (const title of ['센소지', '스시', '긴자']) {
      await itemRepo.create({ tripId, date: '2026-10-24', kind: 'place', title });
    }
    await renderPlan();
    await user.click(await screen.findByRole('button', { name: '3번째 일정, 긴자' }));
    const sheet = screen.getByRole('dialog', { name: '긴자' });
    expect(within(sheet).getByRole('button', { name: '아래로' })).toBeDisabled();

    await user.click(within(sheet).getByRole('button', { name: '위로' }));
    await waitFor(() => expect(within(sheet).getByText('2번째 / 3개')).toBeInTheDocument());
    await user.click(within(sheet).getByRole('button', { name: '위로' }));
    await waitFor(() => expect(within(sheet).getByText('1번째 / 3개')).toBeInTheDocument());
    expect(within(sheet).getByRole('button', { name: '위로' })).toBeDisabled();

    const titles = (await itemRepo.listByDay(tripId, '2026-10-24')).map((i) => i.title);
    expect(titles).toEqual(['긴자', '센소지', '스시']);

    await user.click(within(sheet).getByRole('button', { name: '아래로' }));
    await waitFor(async () =>
      expect((await itemRepo.listByDay(tripId, '2026-10-24')).map((i) => i.title)).toEqual([
        '센소지',
        '긴자',
        '스시',
      ]),
    );
  });

  it('편집에서 시간을 지우면 저장소에서도 지워진다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'place',
      title: '센소지',
      startTime: '09:00',
    });
    await renderPlan();
    await user.click(await screen.findByRole('button', { name: '1번째 일정, 센소지' }));
    await user.click(screen.getByRole('button', { name: '편집' }));
    const sheet = screen.getByRole('dialog', { name: '일정 편집' });
    await user.clear(within(sheet).getByLabelText('시작'));
    await user.click(within(sheet).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장했어요')).toBeInTheDocument();
    const [item] = await itemRepo.listByTrip(tripId);
    expect(item).not.toHaveProperty('startTime');
  });

  it('길찾기: 해외 여행은 Google이 먼저, 이동수단을 바꾸면 링크가 바뀐다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({ tripId, date: '2026-10-24', kind: 'place', title: '센소지' });
    await renderPlan();
    await user.click(await screen.findByRole('button', { name: '1번째 일정, 센소지' }));
    await user.click(screen.getByRole('button', { name: '길찾기' }));

    const sheet = screen.getByRole('dialog', { name: '센소지까지' });
    const links = within(sheet).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Google 지도로 열기');
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('travelmode=transit'));

    await user.click(within(sheet).getByRole('radio', { name: '도보' }));
    await waitFor(() =>
      expect(within(sheet).getByRole('link', { name: 'Google 지도로 열기' })).toHaveAttribute(
        'href',
        expect.stringContaining('travelmode=walking'),
      ),
    );
  });

  it('일차 메뉴: 시간순 정렬 (시간 없는 일정은 제자리)', async () => {
    const user = userEvent.setup();
    await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'place',
      title: '오후',
      startTime: '15:00',
    });
    await itemRepo.create({ tripId, date: '2026-10-24', kind: 'note', title: '메모' });
    await itemRepo.create({
      tripId,
      date: '2026-10-24',
      kind: 'food',
      title: '아침',
      startTime: '08:00',
    });
    await renderPlan();
    await user.click(await screen.findByRole('button', { name: '1일차 · 10.24 (토) 메뉴' }));
    await user.click(screen.getByRole('button', { name: /시간순 정렬/ }));
    expect(await screen.findByText('시간순으로 정렬했어요')).toBeInTheDocument();
    expect((await itemRepo.listByDay(tripId, '2026-10-24')).map((i) => i.title)).toEqual([
      '아침',
      '메모',
      '오후',
    ]);
  });

  it('편집 모드: 손잡이가 보이고 뒤로가기로 끝난다', async () => {
    const user = userEvent.setup();
    await itemRepo.create({ tripId, date: '2026-10-24', kind: 'place', title: '센소지' });
    const router = await renderPlan();
    await user.click(await screen.findByRole('button', { name: '편집' }));
    expect(await screen.findByRole('button', { name: '센소지 옮기기' })).toBeInTheDocument();
    expect(screen.getAllByText('여기로 끌어 놓을 수 있어요').length).toBeGreaterThan(0);
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.queryByRole('button', { name: '센소지 옮기기' })).not.toBeInTheDocument();
  });
});
