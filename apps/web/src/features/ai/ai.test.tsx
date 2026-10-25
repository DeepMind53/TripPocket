import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb, seedSampleTrip } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { Toaster } from '../../shared/ui';

afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
});

it('AI 추천: 직접 입력 → 근거(언급 수·원문 링크·기간)와 함께 결과, 가고 싶은 곳에 담기', async () => {
  await resetLocalDb();
  const tripId = await seedSampleTrip();
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const bodies: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/ai/recommend') {
      bodies.push(String(init?.body));
      return Response.json({
        anchor: '신주쿠역',
        createdAt: '',
        categories: {
          food: {
            months: 3,
            enough: true,
            engine: 'basic',
            places: [
              {
                name: '이치란 신주쿠',
                category: 'food',
                mentions: 7,
                lastMentioned: '20261020',
                score: 6.1,
                adSuspect: false,
                summary: '줄 서도 먹는 돈코츠 라멘',
                sources: [
                  {
                    id: 'p0',
                    title: '신주쿠 라멘 후기',
                    link: 'https://blog.naver.com/a/1',
                    postdate: '20261020',
                  },
                ],
              },
            ],
          },
        },
      });
    }
    return Response.json({}, { status: 404 });
  });
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/ai?trip=${tripId}`] })}
      />
      <Toaster />
    </>,
  );
  await user.type(await screen.findByLabelText('역·지역 이름'), '신주쿠역');
  await user.click(screen.getByRole('button', { name: '카페·핫플' })); // 맛집만 남기기
  await user.click(screen.getByRole('button', { name: /추천 받기/ }));
  expect(JSON.parse(bodies[0]!)).toEqual({
    anchor: { type: 'text', name: '신주쿠역' },
    categories: ['food'],
    domestic: false,
  });

  const results = await screen.findByRole('region', { name: '추천 결과' });
  expect(within(results).getByText('정보가 적어 최근 3개월로 넓혔어요')).toBeInTheDocument();
  expect(within(results).getByText(/AI 요약 없이/)).toBeInTheDocument(); // 무료 AI 한도 → 기본 집계
  expect(within(results).getByText(/블로그 7회 언급 · 최근 10.20/)).toBeInTheDocument();
  await user.click(within(results).getByRole('button', { name: /근거 글 1개/ }));
  expect(within(results).getByRole('link', { name: '신주쿠 라멘 후기' })).toHaveAttribute(
    'href',
    'https://blog.naver.com/a/1',
  );
  await user.click(
    within(results).getByRole('button', { name: '이치란 신주쿠 가고 싶은 곳에 담기' }),
  );
  expect(await screen.findByText('가고 싶은 곳에 담았어요')).toBeInTheDocument();
  expect(
    (await itemRepo.listByTrip(tripId)).some((i) => i.title === '이치란 신주쿠' && i.date === null),
  ).toBe(true);
});

it('지역 입력 드롭다운에서 고르면 그 장소 위치로, 키워드로도 추천 · 결과에 반경·출처 표시', async () => {
  await resetLocalDb();
  const tripId = await seedSampleTrip(); // 도쿄 여행 → 해외(Google)
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const bodies: string[] = [];
  const searches: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/places/search') {
      searches.push(String(init?.body));
      return Response.json({
        places: [
          {
            source: 'google',
            id: 'g-st',
            name: '신주쿠역',
            address: '일본 도쿄도 신주쿠구',
            coords: { lat: 35.6896, lng: 139.7006 },
          },
        ],
      });
    }
    if (url === '/api/v1/ai/recommend') {
      bodies.push(String(init?.body));
      return Response.json({
        anchor: '신주쿠역',
        createdAt: '',
        keyword: '라멘',
        categories: {
          custom: {
            months: 1,
            enough: true,
            radiusKm: 5,
            places: [
              {
                name: '츠루톤탄',
                category: 'custom',
                mentions: 0,
                lastMentioned: '',
                score: 0,
                adSuspect: false,
                summary: '',
                sources: [],
                origin: 'google',
                place: { source: 'google', id: 'g1', name: '츠루톤탄', address: '신주쿠' },
              },
            ],
          },
        },
      });
    }
    return Response.json({}, { status: 404 });
  });
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/ai?trip=${tripId}`] })}
    />,
  );
  await user.type(await screen.findByLabelText('역·지역 이름'), '신주쿠');
  // 해외는 [검색]을 눌렀을 때만
  await user.click(await screen.findByRole('button', { name: '"신주쿠" 장소 검색' }));
  await user.click(await screen.findByRole('option', { name: /신주쿠역/ }));
  expect(JSON.parse(searches[0]!)).toMatchObject({ scope: 'overseas' });
  // 맛집·카페는 끄고 키워드만
  await user.click(screen.getByRole('button', { name: '맛집' }));
  await user.click(screen.getByRole('button', { name: '카페·핫플' }));
  await user.click(screen.getByRole('button', { name: '키워드' }));
  await user.type(screen.getByLabelText('추천받을 키워드'), '라멘');
  await user.click(screen.getByRole('button', { name: /추천 받기/ }));
  expect(JSON.parse(bodies[0]!)).toEqual({
    anchor: { type: 'place', name: '신주쿠역', lat: 35.6896, lng: 139.7006 },
    domestic: false,
    categories: [],
    keyword: '라멘',
  });
  const results = await screen.findByRole('region', { name: '추천 결과' });
  expect(within(results).getByText('"라멘" 추천')).toBeInTheDocument();
  expect(within(results).getByText(/5km 안/)).toBeInTheDocument();
  expect(within(results).getByText(/Google 장소 검색/)).toBeInTheDocument();
});
