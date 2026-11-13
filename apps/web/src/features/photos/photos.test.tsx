import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { db } from '../../data/db';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { photoRepo } from '../../data/repositories/photoRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { useToastStore } from '../../shared/ui/toastStore';

vi.mock('../itinerary/TripMap', () => ({ TripMap: () => null }));

beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-12T03:30:00Z')); // 도쿄 12:30
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function tokyo() {
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-12',
    endDate: '2026-11-14',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-12',
    kind: 'food',
    title: '이치란',
    startTime: '12:00',
    endTime: '13:00',
  });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-12',
    kind: 'place',
    title: '센소지',
    startTime: '15:00',
  });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-13',
    kind: 'place',
    title: '팀랩',
    startTime: '10:00',
  });
  return trip;
}

it('빠른 메뉴 [영수증]으로 찍은 사진이 지금 일정에 붙는다 (기기에만, 2026-11-11 정식)', async () => {
  vi.stubGlobal('fetch', async () => Response.json({}));
  const trip = await tokyo();
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
  const sheet = await screen.findByRole('dialog', { name: '빠른 메뉴' });
  // 칸을 둘로: 카메라로 찍기 / 휴대폰 사진에서 고르기 (여러 장)
  const shoot = within(sheet).getByRole('button', { name: '영수증 카메라로 찍기' });
  const pick = within(sheet).getByRole('button', { name: '영수증 휴대폰 사진에서 고르기' });
  expect(shoot.querySelector('input')).toHaveAttribute('capture', 'environment');
  expect(pick.querySelector('input')).not.toHaveAttribute('capture');
  expect(pick.querySelector('input')).toHaveAttribute('multiple');
  await user.upload(
    shoot.querySelector('input') as HTMLInputElement,
    new File(['jpg'], 'r.jpg', { type: 'image/jpeg' }),
  );
  // 찍으면 붙일 일정을 고른다 (2026-11-13): 오늘 일정, 지금 일정에 [지금]
  const ask = await screen.findByRole('dialog', { name: '어느 일정에 붙일까요' });
  expect(within(ask).getByText('영수증 1장 · 이 기기에만 저장돼요')).toBeInTheDocument();
  expect(await within(ask).findByRole('button', { name: /이치란/ })).toHaveTextContent('지금');
  expect(await db.photos.count()).toBe(0);
  await user.click(within(ask).getByRole('button', { name: /이치란/ }));
  await waitFor(async () => expect(await db.photos.count()).toBe(1));
  expect(useToastStore.getState().items.map((x) => x.message)).toContain('이치란에 붙였어요');
  // 여러 장 고르고, 다른 날·다른 일정에도 붙일 수 있다
  await user.upload(pick.querySelector('input') as HTMLInputElement, [
    new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
  ]);
  const ask2 = await screen.findByRole('dialog', { name: '어느 일정에 붙일까요' });
  await user.click(await within(ask2).findByRole('button', { name: '2일차' }));
  await user.click(await within(ask2).findByRole('button', { name: /팀랩/ }));
  await waitFor(async () => expect(await db.photos.count()).toBe(3));
  const items = await itemRepo.listByTrip(trip.id);
  const title = (id: string) => items.find((i) => i.id === id)?.title;
  const photos = await db.photos.toArray();
  expect(photos.map((p) => title(p.itemId)).sort()).toEqual(['이치란', '팀랩', '팀랩'].sort());
  expect(photos.every((p) => p.kind === 'receipt')).toBe(true);
});

it('photoRepo로 붙인 영수증: 상세에서 [영수증 분석] → 서버 글 → 품목 표 (금액은 저장 안 함)', async () => {
  const trip = await tokyo();
  const item = (await itemRepo.listByTrip(trip.id)).find((i) => i.title === '이치란')!;
  await photoRepo.add({
    tripId: trip.id,
    itemId: item.id,
    kind: 'receipt',
    blob: new Blob(['jpg'], { type: 'image/jpeg' }),
  });
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  );
  vi.stubGlobal('fetch', async (u: string) =>
    String(u).includes('/api/ocr')
      ? Response.json({ text: 'ラーメン 980\n替玉 210\n合計 1,190', source: 'google', left: 19 })
      : Response.json({}),
  );
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan?day=1`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: /이치란/ }));
  await user.click(await screen.findByRole('button', { name: '영수증 1 크게 보기' }));
  const viewer = await screen.findByRole('dialog', { name: '영수증' });
  await user.click(within(viewer).getByRole('button', { name: '영수증 분석' }));
  const table = await within(viewer).findByRole('region', { name: '품목' });
  expect(within(table).getByText('ラーメン')).toBeInTheDocument();
  expect(within(table).getByText('1,190')).toBeInTheDocument();
  const [saved] = await db.photos.toArray();
  expect(Object.keys(saved!).sort()).toEqual(
    ['blob', 'createdAt', 'id', 'itemId', 'kind', 'text', 'textSource', 'tripId'].sort(),
  );
});
