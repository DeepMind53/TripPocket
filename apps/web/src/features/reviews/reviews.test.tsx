import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { setTripRoles } from '../../data/tripRoles';
import { Toaster } from '../../shared/ui';

let tripId = '';
let itemId = '';
let saved: Record<string, unknown>[] = [];

beforeEach(async () => {
  await resetLocalDb();
  saved = [];
  tripId = (
    await tripRepo.create({
      title: '서울',
      destinations: [
        { name: '서울', kind: 'city', countryCode: 'KR', coords: { lat: 37.5, lng: 127 } },
      ],
      startDate: '2020-01-01',
      endDate: '2020-01-02',
      timezone: 'Asia/Seoul',
      cover: {},
    })
  ).id;
  // 검색 없이 직접 적은 일정
  itemId = (await itemRepo.create({ tripId, date: '2020-01-01', kind: 'food', title: '동네 국밥' }))
    .id;
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: '진하', createdAt: '', providers: [], publicNo: 7, points: 0 },
  });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/reviews?'))
      return Response.json({
        reviews: [
          {
            id: 'r0',
            author: 'User#3',
            mine: false,
            kind: 'food',
            placeKey: 'k:123',
            placeName: '동네 국밥',
            ratings: { overall: 4, taste: 5 },
            note: '국물이 진해요',
            visitedOn: '2019-12-01',
            createdAt: '2019-12-02T00:00:00Z',
            updatedAt: '2019-12-02T00:00:00Z',
          },
        ],
        summary: { count: 1, averages: { overall: 4, taste: 5 } },
        mine: null,
      });
    if (url === '/api/reviews' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      saved.push(body);
      return Response.json({
        review: {
          id: 'r1',
          ...body,
          author: '진하',
          mine: true,
          visitedOn: null,
          createdAt: '',
          updatedAt: '',
        },
        pointsAwarded: body.placeKey ? 100 : 0,
        balance: body.placeKey ? 100 : 0,
      });
    }
    if (url === '/api/places/search')
      return Response.json({
        places: [
          {
            source: 'kakao',
            id: '123',
            name: '동네 국밥',
            address: '서울 마포구',
            coords: { lat: 37.55, lng: 126.9 },
            url: 'http://place.map.kakao.com/123',
          },
        ],
      });
    return Response.json({}, { status: 404 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setTripRoles({});
  useAuth.setState({ status: 'unknown', me: null });
});

const renderAt = (path: string) =>
  render(
    <>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      <Toaster />
    </>,
  );

describe('후기 (docs/17)', () => {
  it('일정 상세: 다른 사람 후기 보기 → [후기 입력] → 직접 적은 일정은 장소를 연결해야 +100P', async () => {
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/plan?day=1`);
    await user.click(await screen.findByRole('button', { name: /동네 국밥/ }));
    const detail = await screen.findByRole('dialog', { name: '동네 국밥' });
    const list = await within(detail).findByRole('region', { name: '후기' });
    expect(list).toHaveTextContent('User#3');
    expect(list).toHaveTextContent('국물이 진해요');
    expect(list).toHaveTextContent('맛 5.0');

    await user.click(within(detail).getByRole('button', { name: '후기 입력' }));
    const sheet = await screen.findByRole('dialog', { name: '동네 국밥 후기' });
    // 아직 연결 전 — 연결 안내
    const link = within(sheet).getByRole('region', { name: '장소 연결' });
    expect(link).toHaveTextContent('100P를 받아요');
    await user.click(within(sheet).getByRole('button', { name: '종합 5점' }));
    await user.click(within(sheet).getByRole('button', { name: '맛 4점' }));
    await user.type(within(sheet).getByLabelText('기타'), '또 갈래요');
    await user.click(
      await within(link).findByRole('option', { name: /동네 국밥/ }, { timeout: 3000 }),
    );
    expect(link).toHaveTextContent('연결됨');
    await user.click(within(sheet).getByRole('button', { name: '후기 올리기 · +100P' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      tripId,
      itemId,
      kind: 'food',
      placeKey: 'k:123',
      ratings: { overall: 5, taste: 4 },
      note: '또 갈래요',
    });
    expect(await screen.findByText('후기를 올렸어요 · +100P')).toBeInTheDocument();
    expect(useAuth.getState().me?.points).toBe(100);
    // 일정에도 장소가 붙었다
    expect((await itemRepo.get(itemId))?.place?.externalUrl).toBe('http://place.map.kakao.com/123');
  });

  it('보기 전용으로 공유받은 여행은 [후기 입력]이 없다', async () => {
    setTripRoles({ [tripId]: 'viewer' });
    const user = userEvent.setup();
    renderAt(`/trips/${tripId}/plan?day=1`);
    await user.click(await screen.findByRole('button', { name: /동네 국밥/ }));
    const detail = await screen.findByRole('dialog', { name: '동네 국밥' });
    await within(detail).findByRole('region', { name: '후기' });
    expect(within(detail).queryByRole('button', { name: '후기 입력' })).not.toBeInTheDocument();
  });
});
