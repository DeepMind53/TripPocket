import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { resetReportGuards } from '../../data/lodgingReports';
import { resetAgodaLookup } from '../../data/agodaLookup';
import { resetHotelPrices } from '../../data/hotelPrices';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let tripId = '';
beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-lodging-recent');
  resetReportGuards();
  resetAgodaLookup();
  resetHotelPrices();
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

describe('숙소 최저가 (2026-11-10 정식, docs/28)', () => {
  it('예약 카드 → 이름·날짜가 채워지고, 아고다 링크를 붙이면 경로 21곳 링크 (요청은 기록 목록 1번)', async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      Response.json(String(url).startsWith('/api/lodging/reports') ? { reports: [] } : {}),
    );
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const user = userEvent.setup();
      const router = show(`/trips/${tripId}/bookings`);
      await user.click(await screen.findByRole('link', { name: /최저가 비교/ }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/lodging-price'));
      expect(await screen.findByLabelText('숙소 이름')).toHaveValue('호텔 그레이스리 신주쿠');
      expect(screen.getByLabelText('체크인')).toHaveValue('2026-11-24');
      expect(screen.getByLabelText('체크아웃')).toHaveValue('2026-11-27');

      // 링크 칸은 접혀 있다 — 직접 넣기를 누르면 열림. 아고다가 아닌 링크는 막는다
      await user.click(screen.getByRole('button', { name: '아고다 링크 직접 넣기' }));
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

      const agoda = await screen.findByRole('region', { name: '아고다 경로별' });
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

      // 링크를 넣었으니 자동 찾기는 안 하고, 서버에는 기록 목록 1번 + 참고 가격 1번 (아고다 번호 + 이름 열쇠)
      expect(
        fetchSpy.mock.calls.filter(([u]) => String(u).startsWith('/api/lodging/prices')),
      ).toHaveLength(1);
      const calls = fetchSpy.mock.calls.filter(([u]) =>
        String(u).startsWith('/api/lodging/reports'),
      );
      expect(calls).toHaveLength(1);
      expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('lodging'))).toHaveLength(2);
      expect(calls[0]![0]).toContain('hotelKey=agoda%3A706347');
      expect(calls[0]![0]).toContain('altKey=name');
      expect(await screen.findByText(/아직 기록이 없어요/)).toBeInTheDocument();
      // 최근 검색에 남는다 (아고다 링크 포함)
      expect(JSON.parse(localStorage.getItem('tp-lodging-recent')!)[0]).toMatchObject({
        name: '호텔 그레이스리 신주쿠',
        agoda: expect.stringContaining('706347'),
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('아고다 링크가 없으면 이름으로 자동 찾기 → 다른 후보 고르기 (누를 때만 다시)', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.startsWith('/api/lodging/lookup'))
        return Response.json({
          candidates: [
            { hid: 706347, name: 'Hotel Gracery Shinjuku', city: 'Tokyo' },
            { hid: 60887367, name: 'Gracious Higashi Shinjuku', city: 'Tokyo' },
          ],
        });
      if (u.startsWith('/api/lodging/reports')) return Response.json({ reports: [] });
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const user = userEvent.setup();
      show(`/lodging-price?trip=${tripId}`);
      await user.type(await screen.findByLabelText('숙소 이름'), '신주쿠 그레이스리');
      // 링크 칸은 처음엔 접혀 있다
      expect(screen.queryByLabelText('아고다 숙소 링크 (선택)')).toBeNull();
      await user.click(screen.getByRole('button', { name: '검색' }));
      const agoda = await screen.findByRole('region', { name: '아고다 경로별' });
      expect(
        await within(agoda).findByText('아고다에서 찾은 숙소 · Hotel Gracery Shinjuku'),
      ).toBeInTheDocument();
      expect(within(agoda).getByRole('link', { name: '신한카드 열기' })).toHaveAttribute(
        'href',
        expect.stringContaining('hid=706347&cid=1760133'),
      );
      const lookups = () =>
        fetchSpy.mock.calls.filter(([u]) => String(u).startsWith('/api/lodging/lookup'));
      expect(lookups()).toHaveLength(1);
      expect(lookups()[0]![0]).toBe(
        `/api/lodging/lookup?name=${encodeURIComponent('신주쿠 그레이스리').replaceAll('%20', '+')}`,
      );

      await user.click(within(agoda).getByRole('radio', { name: 'Gracious Higashi Shinjuku' }));
      await waitFor(() =>
        expect(within(agoda).getByRole('link', { name: '신한카드 열기' })).toHaveAttribute(
          'href',
          expect.stringContaining('hid=60887367'),
        ),
      );
      // 후보를 바꿔도 자동 찾기를 다시 하지 않는다
      expect(lookups()).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('자동 찾기를 못 하면 링크 칸을 열고 안내, 날짜가 거꾸로면 검색 잠금', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).startsWith('/api/lodging/lookup')
        ? Response.json({ candidates: [] })
        : Response.json({ reports: [] }),
    );
    const user = userEvent.setup();
    try {
      show(`/lodging-price?trip=${tripId}`);
      // 여행에서 열면 여행 날짜
      expect(await screen.findByLabelText('체크인')).toHaveValue('2026-11-24');
      await user.type(screen.getByLabelText('숙소 이름'), '신주쿠 호텔');
      await user.click(screen.getByRole('button', { name: '검색' }));
      expect(await screen.findByText(/아고다에서 이 숙소를 찾지 못했어요/)).toBeInTheDocument();
      expect(screen.getByLabelText('아고다 숙소 링크 (선택)')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }

    const out = screen.getByLabelText('체크아웃');
    await user.clear(out);
    await user.type(out, '2026-11-20');
    expect(screen.getByRole('alert')).toHaveTextContent('체크아웃은 체크인 뒤 날짜여야 해요');
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
  });

  it('가격 적기: 저장 1번 → 목록에 바로 붙음(다시 불러오지 않음), 내 기록 삭제, 돌아오면 [적기] 한 번', async () => {
    const saved = {
      id: 'r1',
      hotelKey: 'name:신주쿠|',
      hotelName: '신주쿠 호텔',
      checkIn: '2026-11-24',
      nights: 3,
      adults: 2,
      rooms: 1,
      site: 'tripcom',
      price: 135000,
      priceType: 'nightly',
      currency: 'KRW',
      tax: 'unknown',
      tags: ['member'],
      seenOn: '2026-11-09',
      mine: true,
    };
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith('/api/lodging/reports') && init?.method === 'POST')
        return Response.json({ report: saved });
      if (u.startsWith('/api/lodging/reports/') && init?.method === 'DELETE')
        return Response.json({ ok: true });
      if (u.startsWith('/api/lodging/reports'))
        return Response.json({
          reports: [{ ...saved, id: 'r0', site: 'booking', price: 128000, mine: false }],
        });
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const user = userEvent.setup();
      show(`/lodging-price?trip=${tripId}`);
      await user.type(await screen.findByLabelText('숙소 이름'), '신주쿠 호텔');
      await user.click(screen.getByRole('button', { name: '검색' }));
      const list = await screen.findByRole('region', { name: '다른 사람들이 본 가격 · 30일' });
      expect(await within(list).findByText('1박 128,000원')).toBeInTheDocument();
      // 작성자 이름은 없다
      expect(within(list).queryByText(/닉|User#/)).toBeNull();

      // 링크를 눌러 나갔다가 돌아오면 그 줄에 [적기]
      const apps = screen.getByRole('region', { name: '다른 앱에서 찾기' });
      await user.click(within(apps).getByRole('link', { name: '트립닷컴 열기' }));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(await screen.findByText('방금 본 가격을 적을까요')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '적기' }));

      const sheet = await screen.findByRole('dialog', { name: /가격 적기 · 트립닷컴/ });
      const save = within(sheet).getByRole('button', { name: '저장' });
      expect(save).toBeDisabled();
      await user.type(within(sheet).getByLabelText('본 가격'), '135000');
      await user.click(within(sheet).getByRole('button', { name: '회원가' }));
      await user.click(save);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const posts = fetchSpy.mock.calls.filter(([, i]) => i?.method === 'POST');
      expect(posts).toHaveLength(1);
      expect(JSON.parse(String(posts[0]![1]!.body))).toMatchObject({
        site: 'tripcom',
        price: 135000,
        nights: 3,
        tags: ['member'],
      });
      expect(within(list).getByText('1박 135,000원')).toBeInTheDocument();
      // 목록은 처음 1번만 불렀다
      expect(
        fetchSpy.mock.calls.filter(
          ([u, i]) => String(u).startsWith('/api/lodging/reports?') && !i?.method,
        ),
      ).toHaveLength(1);

      await user.click(within(list).getByRole('button', { name: '트립닷컴 내 기록 지우기' }));
      await user.click(await screen.findByRole('button', { name: '삭제' }));
      await waitFor(() => expect(within(list).queryByText('1박 135,000원')).toBeNull());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('기록을 못 불러오면 멈추고, 연타는 앞에서 막는다', async () => {
    const fetchSpy = vi.fn(async (_url: string) => new Response('x', { status: 500 }));
    vi.stubGlobal('fetch', fetchSpy);
    const count = (path: string) =>
      fetchSpy.mock.calls.filter(([u]) => String(u).startsWith(path)).length;
    try {
      const user = userEvent.setup();
      show(`/lodging-price?trip=${tripId}`);
      await user.type(await screen.findByLabelText('숙소 이름'), '신주쿠 호텔');
      await user.click(screen.getByRole('button', { name: '검색' }));
      expect(await screen.findByText(/기록을 불러오지 못했어요/)).toBeInTheDocument();
      expect(screen.getByText(/아고다에서 찾지 못했어요/)).toBeInTheDocument();
      // 자동 재시도 없음 — 찾기 1번 + 기록 1번
      expect(count('/api/lodging/lookup')).toBe(1);
      expect(count('/api/lodging/reports')).toBe(1);
      expect(count('/api/lodging/prices')).toBe(1);
      expect(screen.getByText('참고 가격을 불러오지 못했어요')).toBeInTheDocument();
      // 검색 중에는 버튼 이름이 "찾는 중…" — 다시 [검색]이 될 때까지 기다렸다 누른다 (느린 CI)
      for (let i = 0; i < 6; i++)
        await user.click(await screen.findByRole('button', { name: '검색' }));
      await screen.findByRole('button', { name: '검색' });
      await screen.findByText(/기록을 불러오지 못했어요/);
      // 종류마다 1분에 5번까지만 서버로
      expect(count('/api/lodging/lookup')).toBe(5);
      expect(count('/api/lodging/reports')).toBe(5);
      expect(count('/api/lodging/prices')).toBe(5);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('구글 호텔 참고 가격: 싼 순 5곳 + 접힌 나머지, 같은 조건은 다시 묻지 않음, 무료량이 끝나면 구글 호텔 창 열기', async () => {
    let quota = false;
    const prices = Array.from({ length: 7 }, (_, i) => ({
      source: `site${i}`,
      nightlyKrw: 100000 + i * 1000,
      ...(i === 1 ? { official: true } : {}),
    }));
    const fetchSpy = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.startsWith('/api/lodging/prices'))
        return quota
          ? Response.json({ error: 'prices_quota' }, { status: 503 })
          : Response.json({ hotel: { name: '호텔 그레이스리 신주쿠', prices } });
      if (u.startsWith('/api/lodging/lookup')) return Response.json({ candidates: [] });
      return Response.json({ reports: [] });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const count = () =>
      fetchSpy.mock.calls.filter(([u]) => String(u).startsWith('/api/lodging/prices')).length;
    try {
      const user = userEvent.setup();
      show(`/lodging-price?trip=${tripId}`);
      await user.type(await screen.findByLabelText('숙소 이름'), '그레이스리');
      await user.click(screen.getByRole('button', { name: '검색' }));
      const google = await screen.findByRole('region', { name: '구글 호텔 참고 가격' });
      expect(
        await within(google).findByText('구글에서 찾은 숙소 · 호텔 그레이스리 신주쿠'),
      ).toBeInTheDocument();
      expect(within(google).getByText('1박 100,000원')).toBeInTheDocument();
      expect(within(google).getByText('공식')).toBeInTheDocument();
      expect(within(google).getByText('2곳 더 보기')).toBeInTheDocument();
      const [first] = fetchSpy.mock.calls.filter(([u]) =>
        String(u).startsWith('/api/lodging/prices'),
      );
      expect(new URL(String(first![0]), 'https://x').searchParams.toString()).toBe(
        'name=%EA%B7%B8%EB%A0%88%EC%9D%B4%EC%8A%A4%EB%A6%AC&checkIn=2026-11-24&checkOut=2026-11-27&adults=2',
      );

      // 같은 조건 다시 검색 → 기기 캐시 (요청 0)
      await user.click(await screen.findByRole('button', { name: '검색' }));
      await within(await screen.findByRole('region', { name: '구글 호텔 참고 가격' })).findByText(
        '1박 100,000원',
      );
      expect(count()).toBe(1);

      // 날짜를 바꿨는데 무료량이 끝났으면 안내 + 구글 호텔 창 열기
      quota = true;
      const out = screen.getByLabelText('체크아웃');
      await user.clear(out);
      await user.type(out, '2026-11-26');
      await user.click(await screen.findByRole('button', { name: '검색' }));
      const after = await screen.findByRole('region', { name: '구글 호텔 참고 가격' });
      expect(await within(after).findByText(/이번 달 참고 가격을 다 썼어요/)).toBeInTheDocument();
      expect(within(after).getByRole('link', { name: '구글 호텔에서 보기' })).toHaveAttribute(
        'href',
        expect.stringContaining('google.com/travel/search'),
      );
      expect(count()).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('빠른 메뉴 바로가기에서 늘 고를 수 있다', async () => {
    const user = userEvent.setup();
    show(`/trips/${tripId}/plan`);
    await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
    await user.click(await screen.findByRole('button', { name: '편집' }));
    const sheet = await screen.findByRole('dialog', { name: /바로가기/ });
    expect(await within(sheet).findByRole('button', { name: /숙소 최저가/ })).toBeInTheDocument();
  });
});
