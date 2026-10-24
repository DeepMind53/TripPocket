import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';

let tripId = '';
beforeEach(async () => {
  await resetLocalDb();
  tripId = (
    await tripRepo.create({
      title: '부산',
      destinations: [
        { name: '부산', kind: 'city', countryCode: 'KR', coords: { lat: 35.1, lng: 129 } },
      ],
      startDate: '2026-10-24',
      endDate: '2026-10-26',
      timezone: 'Asia/Seoul',
      cover: {},
    })
  ).id;
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/places/search')
      return Response.json({
        places: Array.from({ length: 5 }, (_, i) => ({
          source: 'kakao',
          id: String(i),
          name: `해운대 호텔 ${i + 1}`,
          address: `부산 해운대구 ${i + 1}`,
          coords: { lat: 35.16, lng: 129.16 },
          phone: `051-000-000${i + 1}`,
        })),
      });
    return Response.json({}, { status: 404 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
});

it('숙소 이름 검색: 추천 3개 + 더보기 창, 고르면 이름·주소·연락처를 채운다', async () => {
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${tripId}/bookings`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: '예약 추가' }));
  const sheet = screen.getByRole('dialog', { name: '예약 추가' });
  await user.click(within(sheet).getByRole('button', { name: '숙소' }));
  await user.type(within(sheet).getByLabelText('숙소 이름'), '해운대 호텔');
  const list = await within(sheet).findByRole(
    'listbox',
    { name: '장소 검색 결과' },
    { timeout: 3000 },
  );
  expect(within(list).getAllByRole('option')).toHaveLength(3);
  await user.click(within(list).getByRole('button', { name: /더보기 \(2곳\)/ }));
  const more = await screen.findByRole('dialog', { name: '"해운대 호텔" 검색 결과' });
  expect(within(more).getAllByRole('option')).toHaveLength(5);
  await user.click(within(more).getByRole('option', { name: /해운대 호텔 5/ }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: /검색 결과/ })).not.toBeInTheDocument(),
  );
  expect(within(sheet).getByLabelText('숙소 이름')).toHaveValue('해운대 호텔 5');
  expect(within(sheet).getByLabelText('주소')).toHaveValue('부산 해운대구 5');
  expect(within(sheet).getByLabelText('연락처')).toHaveValue('051-000-0005');
});
