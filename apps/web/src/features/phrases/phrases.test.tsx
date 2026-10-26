import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';

let tripId = '';
beforeEach(async () => {
  await resetLocalDb();
  tripId = (
    await tripRepo.create({
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-10-24',
      endDate: '2026-10-26',
      timezone: 'Asia/Tokyo',
      cover: {},
    })
  ).id;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) =>
    url === '/api/places/local' &&
    JSON.parse(String(init?.body)).lang === 'ja' &&
    JSON.parse(String(init?.body)).placeId === 'ChIJ_hotel_123'
      ? Response.json({ name: 'ホテルグレイスリー新宿', address: '東京都新宿区歌舞伎町1-19-1' })
      : Response.json({}, { status: 404 }),
  );
});
afterEach(() => vi.unstubAllGlobals());

it('번역·회화: 여행지 말(일본어) 기본, 누르면 크게, 파파고·Google 바로가기 (docs/20 G7)', async () => {
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/phrases?trip=${tripId}`] })}
    />,
  );
  await waitFor(() => expect(screen.getByRole('radio', { name: '일본어' })).toBeChecked());
  expect(screen.getByRole('link', { name: /파파고/ })).toHaveAttribute(
    'href',
    'https://papago.naver.com/?sk=ko&tk=ja',
  );
  await user.click(screen.getByRole('button', { name: /화장실 어디예요/ }));
  expect(screen.getByRole('dialog', { name: 'トイレはどこですか？' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '닫기' }));
  await user.click(screen.getByRole('radio', { name: '태국어' }));
  expect(screen.getByRole('button', { name: /얼마예요/ })).toHaveTextContent('ราคาเท่าไหร่');
});

it('택시 카드: 해외 장소 일정 상세 → [택시] → 현지어 "여기로 가 주세요" + 현지어 이름·주소 (docs/20 G4)', async () => {
  await itemRepo.create({
    tripId,
    date: '2026-10-24',
    kind: 'lodging',
    title: '호텔',
    place: {
      name: '호텔 그레이스리 신주쿠',
      address: '도쿄 신주쿠구',
      googlePlaceId: 'ChIJ_hotel_123',
    },
  });
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${tripId}/plan?day=1`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: /호텔/ }));
  const sheet = await screen.findByRole('dialog', { name: '호텔' });
  await user.click(within(sheet).getByRole('button', { name: '택시' }));
  const card = await screen.findByRole('dialog', { name: 'ここへ行ってください' });
  expect(await within(card).findByText('ホテルグレイスリー新宿')).toBeInTheDocument();
  expect(within(card).getByText('東京都新宿区歌舞伎町1-19-1')).toBeInTheDocument();
});
