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
