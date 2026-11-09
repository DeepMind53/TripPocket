import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { setLab } from '../../data/labsStore';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let tripId = '';
beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-lodging-recent');
  tripId = (
    await tripRepo.create({
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-11-24',
      endDate: '2026-11-27',
      timezone: 'Asia/Tokyo',
      cover: {},
    })
  ).id;
  await bookingRepo.create({
    tripId,
    kind: 'lodging',
    title: '호텔 그레이스리 신주쿠',
    start: { date: '2026-11-24', time: '15:00' },
    end: { date: '2026-11-27', time: '11:00' },
  });
});
afterEach(() => setLab('lodgingPrice', false, { silent: true }));

const show = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  );
  return router;
};

describe('숙소 최저가 (실험실, docs/28)', () => {
  it('실험실을 끄면 예약 카드에 버튼이 없다', async () => {
    show(`/trips/${tripId}/bookings`);
    await screen.findByText('호텔 그레이스리 신주쿠');
    expect(screen.queryByRole('link', { name: /최저가 비교/ })).toBeNull();
  });

  it('예약 카드 → 이름·날짜가 채워지고, 아고다 링크를 붙이면 경로 21곳 링크 (요청 없음)', async () => {
    setLab('lodgingPrice', true, { silent: true });
    const fetchSpy = vi.fn(async (_url: string) => Response.json({}));
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const user = userEvent.setup();
      const router = show(`/trips/${tripId}/bookings`);
      await user.click(await screen.findByRole('link', { name: /최저가 비교/ }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/lodging-price'));
      expect(await screen.findByLabelText('숙소 이름')).toHaveValue('호텔 그레이스리 신주쿠');
      expect(screen.getByLabelText('체크인')).toHaveValue('2026-11-24');
      expect(screen.getByLabelText('체크아웃')).toHaveValue('2026-11-27');

      // 아고다가 아닌 링크는 막는다
      const link = screen.getByLabelText('아고다 숙소 링크 (선택)');
      await user.type(link, 'https://www.booking.com/hotel/jp/x.html');
      expect(screen.getByRole('alert')).toHaveTextContent('아고다 숙소 링크가 아니에요');
      expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
      await user.clear(link);
      await user.type(
        link,
        '그레이스리 https://www.agoda.com/search?selectedproperty=706347&cid=1',
      );
      await user.click(screen.getByRole('button', { name: '검색' }));

      const agoda = screen.getByRole('region', { name: '아고다 경로별' });
      expect(within(agoda).getByRole('link', { name: '신한카드 열기' })).toHaveAttribute(
        'href',
        'https://www.agoda.com/partners/partnersearch.aspx?hid=706347&cid=1760133&checkin=2026-11-24&checkout=2026-11-27&NumberofAdults=2&Rooms=1',
      );
      // 전체 = 기본 1 + 경로 20 (+ 접힌 할인 안내 17)
      const list = within(agoda).getAllByRole('list')[0]!;
      expect(within(list).getAllByRole('link')).toHaveLength(21);
      await user.click(within(agoda).getByRole('radio', { name: /항공사/ }));
      expect(within(within(agoda).getAllByRole('list')[0]!).getAllByRole('link')).toHaveLength(3);

      // 다른 앱: 아고다 버튼도 그 숙소로, NOL은 이름을 복사하고 연다
      const apps = screen.getByRole('region', { name: '다른 앱에서 찾기' });
      expect(within(apps).getByRole('link', { name: '아고다 열기' })).toHaveAttribute(
        'href',
        expect.stringContaining('hid=706347&cid=-1'),
      );
      expect(within(apps).getByRole('link', { name: '트립닷컴 열기' })).toHaveAttribute(
        'href',
        expect.stringContaining('checkIn=2026-11-24'),
      );
      // 도쿄 여행 = 해외: 여기어때는 이름을 복사해 연다
      expect(screen.getByRole('radio', { name: '해외' })).toBeChecked();
      expect(within(apps).getByRole('link', { name: '여기어때 열기' })).toHaveAttribute(
        'href',
        'https://www.yeogi.com/',
      );
      expect(within(apps).getByText('날짜는 앱에서 골라요')).toBeInTheDocument();
      await user.click(within(apps).getByRole('link', { name: 'NOL 열기' }));
      expect(await navigator.clipboard.readText()).toBe('호텔 그레이스리 신주쿠');

      // 링크만 만든다 — 서버·외부 요청 없음
      expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('lodging'))).toEqual([]);
      // 최근 검색에 남는다 (아고다 링크 포함)
      expect(JSON.parse(localStorage.getItem('tp-lodging-recent')!)[0]).toMatchObject({
        name: '호텔 그레이스리 신주쿠',
        agoda: expect.stringContaining('706347'),
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('아고다 링크가 없으면 붙여 넣는 방법 안내, 날짜가 거꾸로면 검색 잠금', async () => {
    setLab('lodgingPrice', true, { silent: true });
    const user = userEvent.setup();
    show(`/lodging-price?trip=${tripId}`);
    // 여행에서 열면 여행 날짜
    expect(await screen.findByLabelText('체크인')).toHaveValue('2026-11-24');
    await user.type(screen.getByLabelText('숙소 이름'), '신주쿠 호텔');
    await user.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.getByText(/경로별 가격은 아고다 링크가 필요해요/)).toBeInTheDocument();

    const out = screen.getByLabelText('체크아웃');
    await user.clear(out);
    await user.type(out, '2026-11-20');
    expect(screen.getByRole('alert')).toHaveTextContent('체크아웃은 체크인 뒤 날짜여야 해요');
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
  });

  it('빠른 메뉴 바로가기는 실험을 켰을 때만 고를 수 있다', async () => {
    const user = userEvent.setup();
    show(`/trips/${tripId}/plan`);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(await screen.findByRole('button', { name: '편집' }));
    const sheet = await screen.findByRole('dialog', { name: /바로가기/ });
    expect(within(sheet).queryByRole('button', { name: /숙소 최저가/ })).toBeNull();
    setLab('lodgingPrice', true, { silent: true });
    expect(await within(sheet).findByRole('button', { name: /숙소 최저가/ })).toBeInTheDocument();
  });
});
