import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let tripId = '';
let searches: string[];

beforeEach(async () => {
  await resetLocalDb();
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [
      { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.69 } },
    ],
    startDate: '2026-10-26', // 월요일
    endDate: '2026-10-27',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  tripId = trip.id;
  searches = [];
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/places/search') {
      searches.push(String(init?.body));
      return Response.json({
        places: [
          {
            source: 'google',
            id: 'ChIJ_ichiran',
            name: '이치란 신주쿠',
            address: '도쿄 신주쿠구',
            coords: { lat: 35.69, lng: 139.7 },
          },
          {
            source: 'google',
            id: 'ChIJ_other',
            name: '이치란 시부야',
            address: '도쿄 시부야구',
            coords: { lat: 35.66, lng: 139.7 },
          },
        ],
        google: true,
      });
    }
    if (url.startsWith('/api/places/google/'))
      return Response.json({
        rating: 4.3,
        userRatingCount: 2100,
        weekdayText: ['월요일: 오전 10:00~오후 10:00', '화요일: 휴무일', '', '', '', '', ''],
        periods: [{ day: 1, open: '10:00', close: '22:00' }],
      });
    return Response.json({}, { status: 404 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
});

describe('일정 입력 장소 검색', () => {
  it('입력하면 비슷한 장소 드롭다운 → 고르면 이름·주소·좌표·Google id 저장, 영업시간 밖이면 경고', async () => {
    const user = userEvent.setup();
    render(
      <>
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: [`/trips/${tripId}/plan`] })}
        />
        <Toaster />
      </>,
    );
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.26 (월)' });
    await user.click(within(day1).getByRole('button', { name: /일정 추가/ }));
    const sheet = await screen.findByRole('dialog', { name: '일정 추가' });
    await user.type(within(sheet).getByLabelText('이름'), '이치란');

    const list = await within(sheet).findByRole('listbox', { name: '장소 검색 결과' });
    // 해외 여행 → overseas, 여행지 좌표로 가까운 곳 우선
    expect(JSON.parse(searches.at(-1)!)).toEqual({
      q: '이치란',
      scope: 'overseas',
      near: { lat: 35.68, lng: 139.69 },
    });
    expect(
      within(list).getByRole('button', { name: '이치란 신주쿠 지도에서 보기' }),
    ).toBeInTheDocument();
    await user.click(within(list).getByRole('option', { name: /이치란 신주쿠/ }));
    expect(within(sheet).getByLabelText('이름')).toHaveValue('이치란 신주쿠');
    expect(within(sheet).getByLabelText('주소')).toHaveValue('도쿄 신주쿠구');
    expect(within(sheet).queryByRole('listbox')).not.toBeInTheDocument();

    await user.type(within(sheet).getByLabelText('시작'), '0930');
    await user.click(within(sheet).getByRole('button', { name: /영업시간·평점 보기/ }));
    expect(await within(sheet).findByText('월요일: 오전 10:00~오후 10:00')).toBeInTheDocument();
    expect(within(sheet).getByRole('alert')).toHaveTextContent('09:30은 영업시간이 아닐 수 있어요');

    await user.click(within(sheet).getByRole('button', { name: '일정에 추가' }));
    await waitFor(async () => expect(await itemRepo.listByTrip(tripId)).toHaveLength(1));
    const [saved] = await itemRepo.listByTrip(tripId);
    expect(saved!.place).toMatchObject({
      address: '도쿄 신주쿠구',
      coords: { lat: 35.69, lng: 139.7 },
      coordsSource: 'google',
      googlePlaceId: 'ChIJ_ichiran',
    });
    // 평점·영업시간은 저장하지 않는다 (Google 약관)
    expect(JSON.stringify(saved)).not.toMatch(/4\.3|2100|10:00~/);
  });
});
