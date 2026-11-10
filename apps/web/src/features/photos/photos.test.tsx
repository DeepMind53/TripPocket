import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { db } from '../../data/db';
import { resetLocalDb } from '../../data/dev';
import { setLab } from '../../data/labsStore';
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
  setLab('tripPhotos', false, { silent: true });
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
  return trip;
}

it('실험을 켜면 빠른 메뉴 [영수증]으로 찍은 사진이 지금 일정에 붙는다 (기기에만)', async () => {
  vi.stubGlobal('fetch', async () => Response.json({}));
  setLab('tripPhotos', true, { silent: true });
  const trip = await tokyo();
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
  const sheet = await screen.findByRole('dialog', { name: '빠른 메뉴' });
  const receipt = within(sheet).getByRole('button', { name: /영수증/ });
  const input = receipt.querySelector('input[type=file]') as HTMLInputElement;
  expect(input).toHaveAttribute('capture', 'environment');
  await user.upload(input, new File(['jpg'], 'r.jpg', { type: 'image/jpeg' }));
  await waitFor(async () => expect(await db.photos.count()).toBe(1));
  expect(useToastStore.getState().items.map((x) => x.message)).toContain('이치란에 붙였어요');
  const [p] = await db.photos.toArray();
  const items = await itemRepo.listByTrip(trip.id);
  expect(items.find((i) => i.id === p!.itemId)?.title).toBe('이치란');
  expect(p).toMatchObject({ kind: 'receipt' });
});

it('실험이 꺼져 있으면 빠른 메뉴에 사진·영수증이 없다', async () => {
  const trip = await tokyo();
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
  const sheet = await screen.findByRole('dialog', { name: '빠른 메뉴' });
  expect(within(sheet).queryByRole('button', { name: /영수증/ })).toBeNull();
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
