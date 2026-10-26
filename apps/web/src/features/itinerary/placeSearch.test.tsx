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
  // 세 패키지 시험이 동시에 돌아 CPU가 바쁠 때 드물게(5번 중 1번 미만) 실패 — 원인 조사 중이라 두 번까지 다시 (2026-10-24)
  it(
    '입력하면 비슷한 장소 드롭다운 → 고르면 이름·주소·좌표·Google id 저장, 영업시간 밖이면 경고',
    { retry: 2 },
    async () => {
      const user = userEvent.setup();
      render(
        <>
          <RouterProvider
            router={createMemoryRouter(routes, {
              initialEntries: [`/trips/${tripId}/plan?day=all`],
            })}
          />
          <Toaster />
        </>,
      );
      const day1 = await screen.findByRole('region', { name: '1일차 · 10.26 (월)' });
      await user.click(within(day1).getByRole('button', { name: /일정 추가/ }));
      const sheet = await screen.findByRole('dialog', { name: '일정 추가' });
      await user.type(within(sheet).getByLabelText('이름'), '이치란');
      // 해외(유료)는 글자마다 부르지 않고 [검색]을 눌렀을 때만 (사용자 요청 2026-10-26)
      const before = searches.length;
      await new Promise((r) => setTimeout(r, 700));
      expect(searches.length).toBe(before);
      await user.click(within(sheet).getByRole('button', { name: '"이치란" 장소 검색' }));

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
      expect(await within(sheet).findByRole('alert')).toHaveTextContent(
        '09:30은 영업시간이 아닐 수 있어요',
      );

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
    },
  );
});

describe('무료량이 끝났을 때 백업 (docs/23, 사용자 결정 2026-10-26)', () => {
  async function openForm() {
    const user = userEvent.setup();
    render(
      <>
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: [`/trips/${tripId}/plan?day=all`] })}
        />
        <Toaster />
      </>,
    );
    const day1 = await screen.findByRole('region', { name: '1일차 · 10.26 (월)' });
    await user.click(within(day1).getByRole('button', { name: /일정 추가/ }));
    const sheet = await screen.findByRole('dialog', { name: '일정 추가' });
    return { user, sheet };
  }

  it('Google 자동완성 백업: 고르면 같은 세션으로 주소·좌표를 받아 저장 · 평점은 트립포켓 후기 + Google 지도 링크', async () => {
    const basics: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === '/api/places/search')
        return Response.json({
          places: [
            {
              source: 'google',
              id: 'ChIJ_ac',
              name: '이치란 신주쿠',
              address: '일본 도쿄',
              coords: null,
              session: '11111111-2222-3333-4444-555555555555',
            },
          ],
          google: true,
          fallback: 'google_autocomplete',
        });
      if (url.startsWith('/api/places/google/ChIJ_ac/basic')) {
        basics.push(url);
        return Response.json({ address: '도쿄 신주쿠구 1-2', coords: { lat: 35.69, lng: 139.7 } });
      }
      if (url === '/api/places/google/ChIJ_ac')
        return Response.json({
          source: 'trippocket',
          rating: 4.5,
          userRatingCount: 2,
          googleMapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJ_ac',
        });
      return Response.json({}, { status: 404 });
    });
    const { user, sheet } = await openForm();
    await user.type(within(sheet).getByLabelText('이름'), '이치란');
    await user.click(within(sheet).getByRole('button', { name: '"이치란" 장소 검색' }));
    expect(
      await within(sheet).findByText('무료 검색 한도가 끝나 다른 검색으로 찾았어요'),
    ).toBeInTheDocument();
    await user.click(within(sheet).getByRole('option', { name: /이치란 신주쿠/ }));
    await waitFor(() =>
      expect(within(sheet).getByLabelText('주소')).toHaveValue('도쿄 신주쿠구 1-2'),
    );
    expect(basics).toEqual([
      '/api/places/google/ChIJ_ac/basic?session=11111111-2222-3333-4444-555555555555',
    ]);
    await user.click(within(sheet).getByRole('button', { name: /영업시간·평점 보기/ }));
    expect(await within(sheet).findByText('트립포켓 후기 2개')).toBeInTheDocument();
    expect(within(sheet).getByText(/Google 무료 사용량이 끝나/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: '일정에 추가' }));
    await waitFor(async () => expect(await itemRepo.listByTrip(tripId)).toHaveLength(1));
    const [saved] = await itemRepo.listByTrip(tripId);
    expect(saved!.place).toMatchObject({
      coords: { lat: 35.69, lng: 139.7 },
      coordsSource: 'google',
      googlePlaceId: 'ChIJ_ac',
    });
    expect(JSON.stringify(saved)).not.toMatch(/session|4\.5/);
  });

  it('Geoapify 백업: OpenStreetMap 배지와 "Powered by Geoapify" 표기, 좌표 출처 osm', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url === '/api/places/search'
        ? Response.json({
            places: [
              {
                source: 'osm',
                id: 'geo1',
                name: 'Ichiran Shinjuku',
                address: 'Shinjuku, Tokyo',
                coords: { lat: 35.69, lng: 139.7 },
              },
            ],
            google: false,
            fallback: 'geoapify',
          })
        : Response.json({}, { status: 404 }),
    );
    const { user, sheet } = await openForm();
    await user.type(within(sheet).getByLabelText('이름'), '이치란');
    await user.click(within(sheet).getByRole('button', { name: '"이치란" 장소 검색' }));
    expect(await within(sheet).findByRole('link', { name: 'Powered by Geoapify' })).toHaveAttribute(
      'href',
      'https://www.geoapify.com/',
    );
    expect(within(sheet).getByLabelText('OpenStreetMap')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('option', { name: /Ichiran Shinjuku/ }));
    await user.click(within(sheet).getByRole('button', { name: '일정에 추가' }));
    await waitFor(async () => expect(await itemRepo.listByTrip(tripId)).toHaveLength(1));
    const [saved] = await itemRepo.listByTrip(tripId);
    expect(saved!.place).toMatchObject({ coordsSource: 'osm', coords: { lat: 35.69, lng: 139.7 } });
  });
});
