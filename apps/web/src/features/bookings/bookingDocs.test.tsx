import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { db } from '../../data/db';
import { resetLocalDb } from '../../data/dev';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

let uploads: string[] = [];
beforeEach(async () => {
  await resetLocalDb();
  uploads = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url.includes('/attachments')) {
      uploads.push(url);
      return Response.json({ id: 'x' });
    }
    if (url.endsWith('/attachments')) return Response.json({ attachments: [] });
    return Response.json({}, { status: 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const base = { timezone: 'Asia/Seoul', cover: {}, destinations: [] as never[] };

it('예약 편집: PDF 붙이기(서버에도 올림) · 10MB 넘으면 거절 (docs/20 G2)', async () => {
  const trip = await tripRepo.create({
    ...base,
    title: '부산',
    startDate: '2099-01-01',
    endDate: '2099-01-02',
  });
  const b = await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '호텔',
    start: { date: '2099-01-01' },
    end: { date: '2099-01-02' },
  });
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/bookings`] })}
      />
      <Toaster />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: /호텔/ }));
  const sheet = await screen.findByRole('dialog');
  const input = within(sheet).getByLabelText('+ 파일 붙이기 (PDF·사진)');
  await user.upload(input, new File(['%PDF-1.4'], '바우처.pdf', { type: 'application/pdf' }));
  expect(
    await within(sheet).findByRole('button', { name: '바우처.pdf 지우기' }),
  ).toBeInTheDocument();
  expect(uploads).toHaveLength(1);
  const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', {
    type: 'application/pdf',
  });
  await user.upload(input, big);
  expect(await screen.findByText(/10MB가 넘는 파일은/)).toBeInTheDocument();
  expect(await attachmentRepo.listByBooking(b.id)).toHaveLength(1);
});

it('설정 → 기기 데이터 정리: 지난 여행 문서만 두 번 눌러 지운다', async () => {
  const past = await tripRepo.create({
    ...base,
    title: '지난',
    startDate: '2020-01-01',
    endDate: '2020-01-02',
  });
  const now = await tripRepo.create({
    ...base,
    title: '다가올',
    startDate: '2099-01-01',
    endDate: '2099-01-02',
  });
  const row = (id: string, tripId: string) => ({
    id,
    tripId,
    bookingId: 'b',
    name: `${id}.pdf`,
    mime: 'application/pdf',
    size: 1024 * 1024,
    blob: new Blob(['x']),
    createdAt: 'x',
    remote: 0 as const,
  });
  await db.attachments.bulkAdd([row('old', past.id), row('new', now.id)]);
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />
      <Toaster />
    </>,
  );
  const group = await screen.findByRole('region', { name: '기기 데이터 정리' });
  await waitFor(() => expect(group).toHaveTextContent('1개 · 1.0MB'));
  const clear = within(group).getAllByRole('button', { name: '지우기' })[0]!;
  await user.click(clear);
  expect(within(group).getByRole('button', { name: '한 번 더 누르면 지워요' })).toBeInTheDocument();
  await user.click(within(group).getByRole('button', { name: '한 번 더 누르면 지워요' }));
  await waitFor(async () =>
    expect((await db.attachments.toArray()).map((a) => a.id)).toEqual(['new']),
  );
});
