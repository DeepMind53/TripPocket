import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';
import { acceptDelete } from '../../test/confirm';

let tripId = '';

beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
  const trip = await tripRepo.create({
    title: '도쿄 가을여행',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    timezone: 'Asia/Tokyo',
    cover: { emoji: '🗼' },
  });
  tripId = trip.id;
  await itemRepo.create({ tripId, date: '2026-10-24', kind: 'place', title: '1일차 일정' });
  await itemRepo.create({ tripId, date: '2026-10-26', kind: 'place', title: '3일차 일정' });
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

const settingsEntries = () => [`/trips/${tripId}/plan`, `/trips/${tripId}/settings`];

async function pickPeriod(user: ReturnType<typeof userEvent.setup>, start: string, end: string) {
  await user.click(await screen.findByRole('button', { name: /변경/ }));
  const sheet = screen.getByRole('dialog', { name: '기간' });
  await user.click(within(sheet).getByRole('button', { name: start }));
  await user.click(within(sheet).getByRole('button', { name: end }));
  await user.click(within(sheet).getByRole('button', { name: '선택 완료' }));
}

describe('여행 설정', () => {
  it('출발을 미루면 일차 유지로 일정 날짜가 함께 밀린다', async () => {
    const user = userEvent.setup();
    const router = renderAt(settingsEntries());
    await pickPeriod(user, '10.25 (일)', '10.27 (화)');
    expect(await screen.findByText('일정 2개의 날짜가 함께 옮겨져요')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장했어요')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/trips/${tripId}/plan`));
    const items = await itemRepo.listByTrip(tripId);
    expect(items.map((i) => [i.title, i.date])).toEqual([
      ['1일차 일정', '2026-10-25'],
      ['3일차 일정', '2026-10-27'],
    ]);
  });

  it('날짜 유지를 고르면 기간 밖 일정은 가고 싶은 곳으로', async () => {
    const user = userEvent.setup();
    renderAt(settingsEntries());
    await pickPeriod(user, '10.25 (일)', '10.27 (화)');
    await user.click(screen.getByRole('radio', { name: '날짜 유지' }));
    expect(await screen.findByText(/일정 1개가 .가고 싶은 곳.으로 옮겨져요/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    const wish = await itemRepo.listByDay(tripId, null);
    expect(wish.map((i) => i.title)).toEqual(['1일차 일정']);
  });

  it('이름을 바꾸고 저장하면 헤더에 반영된다', async () => {
    const user = userEvent.setup();
    renderAt(settingsEntries());
    const name = await screen.findByLabelText('여행 이름');
    await user.clear(name);
    await user.type(name, '도쿄 3박');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('heading', { name: '🗼 도쿄 3박' })).toBeInTheDocument();
  });

  it('여행 메뉴에서 삭제하면 목록으로 가고 실행 취소할 수 있다', async () => {
    const user = userEvent.setup();
    const router = renderAt(['/trips', `/trips/${tripId}/plan`]);
    await user.click(await screen.findByRole('button', { name: '더보기' }));
    await user.click(screen.getByRole('button', { name: '여행 삭제' }));
    await acceptDelete(user);
    expect(await screen.findByText('여행을 삭제했어요')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/trips');
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByText('도쿄 가을여행')).toBeInTheDocument();
  });
});
