import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  return router;
}

beforeEach(async () => {
  await resetLocalDb();
  // 오늘 = 2026-10-22 (Date만 고정, 타이머는 실제로)
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('여행 만들기', () => {
  it('도시 → 날짜 → 이름 순으로 만들고 일정 화면으로 이동한다', async () => {
    const user = userEvent.setup();
    const router = renderAt('/trips/new');

    expect(await screen.findByRole('heading', { name: '어디로 떠나세요?' })).toBeInTheDocument();
    const next = () => screen.getByRole('button', { name: '다음' });
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /도쿄/ }));
    await user.click(next());

    expect(screen.getByRole('heading', { name: '언제 떠나세요?' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?step=2');
    await user.click(screen.getByRole('button', { name: '10.24 (토)' }));
    await user.click(screen.getByRole('button', { name: '10.28 (수)' }));
    expect(screen.getByText(/4박 5일/)).toBeInTheDocument();
    await user.click(next());

    const title = screen.getByLabelText('여행 이름');
    expect(title).toHaveValue('도쿄 여행');
    await user.clear(title);
    await user.type(title, '도쿄 가을여행');
    await user.click(screen.getByRole('button', { name: '여행 만들기' }));

    await screen.findByText('여행을 만들었어요');
    const [trip] = await tripRepo.listActive();
    expect(trip).toMatchObject({
      title: '도쿄 가을여행',
      destinations: [
        {
          name: '도쿄',
          kind: 'city',
          countryCode: 'JP',
          timezone: 'Asia/Tokyo',
          coords: { lat: 35.68, lng: 139.69 },
        },
      ],
      startDate: '2026-10-24',
      endDate: '2026-10-28',
      timezone: 'Asia/Tokyo',
      cover: { emoji: '🇯🇵' },
    });
    // 헤더에 실제 여행 정보
    expect(await screen.findByRole('heading', { name: '🇯🇵 도쿄 가을여행' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/trips/${trip?.id}/plan`);
    // 만들기 단계 기록은 걷어내서, 뒤로 가면 만들기 전 화면
    expect(router.state.historyAction).toBe('REPLACE');
    // 기기 시간대가 여행지와 다르면 뒤에 " · 현지 12:00"이 붙는다 (CI는 UTC)
    expect(screen.getByText(/^2026\.10\.24 – 10\.28 · D-2/)).toBeInTheDocument();
  });

  it('영어·나라 이름으로 찾고, 나라를 고르면 대표 도시 시간대가 들어간다', async () => {
    const user = userEvent.setup();
    renderAt('/trips/new');
    const search = await screen.findByLabelText('도시 검색');

    await user.type(search, 'danang');
    const results = screen.getByRole('list', { name: '검색 결과' });
    expect(within(results).getAllByRole('button')[0]).toHaveTextContent('Da Nang · 베트남');

    await user.clear(search);
    await user.type(search, '일본');
    const first = within(screen.getByRole('list', { name: '검색 결과' })).getAllByRole('button')[0];
    expect(first).toHaveTextContent('나라 전체');
    await user.click(first as HTMLElement);
    expect(screen.getByRole('button', { name: '일본 빼기' })).toBeInTheDocument();
  });

  it('목록에 없는 곳은 직접 추가할 수 있다', async () => {
    const user = userEvent.setup();
    renderAt('/trips/new');
    await user.type(await screen.findByLabelText('도시 검색'), '우리 동네 바닷가');
    await user.click(screen.getByRole('button', { name: /‘우리 동네 바닷가’ 직접 추가/ }));
    expect(screen.getByRole('button', { name: '우리 동네 바닷가 빼기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });
});

describe('내 여행 목록', () => {
  const base = {
    destinations: [{ name: '도쿄', kind: 'city' as const, countryCode: 'JP' }],
    timezone: 'Asia/Seoul',
    cover: { emoji: '🗼' },
  };

  it('여행 중 · 다가오는 · 다녀온 여행으로 나눠 보여준다', async () => {
    await tripRepo.create({
      ...base,
      title: '지금 여행',
      startDate: '2026-10-21',
      endDate: '2026-10-23',
    });
    await tripRepo.create({
      ...base,
      title: '다음 여행',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });
    await tripRepo.create({
      ...base,
      title: '지난 여행',
      startDate: '2026-09-01',
      endDate: '2026-09-02',
    });
    renderAt('/trips');

    const ongoing = (await screen.findByRole('heading', { name: '📌 여행 중' })).closest('section');
    expect(within(ongoing as HTMLElement).getByText('지금 여행')).toBeInTheDocument();
    expect(within(ongoing as HTMLElement).getByText('여행 중 · 2일차')).toBeInTheDocument();
    const upcoming = screen.getByRole('heading', { name: '다가오는 여행' }).closest('section');
    expect(within(upcoming as HTMLElement).getByText('D-10')).toBeInTheDocument();
    expect(screen.getByText('다녀온 여행 1')).toBeInTheDocument();
  });

  it('삭제하고 실행 취소할 수 있다', async () => {
    const user = userEvent.setup();
    await tripRepo.create({
      ...base,
      title: '제주',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    });
    renderAt('/trips');

    await user.click(await screen.findByRole('button', { name: '제주 메뉴' }));
    await user.click(screen.getByRole('button', { name: '여행 삭제' }));
    expect(await screen.findByText('아직 여행이 없어요')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByText('제주')).toBeInTheDocument();
  });

  it('없는 여행 주소는 안내를 보여준다', async () => {
    renderAt('/trips/0190f2a4-0000-7000-8000-000000000000/plan');
    expect(
      await screen.findByText('삭제됐거나 다른 기기에서 만든 여행일 수 있어요'),
    ).toBeInTheDocument();
  });
});
