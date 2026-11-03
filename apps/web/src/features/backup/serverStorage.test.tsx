import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetLocalDb } from '../../data/dev';
import { db } from '../../data/db';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { ServerStorage } from './ServerStorage';

const MB = 1024 * 1024;

beforeEach(async () => {
  await resetLocalDb();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('서버 저장 용량: 사용(빨강)·1주일 안에 지워질 것(연한 빨강)·전체(파랑), 여행별 자세히', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json({
      used: 120 * MB,
      expiring: 40 * MB,
      limit: 500 * MB,
      trips: [{ tripId: 't', title: '오사카', used: 40 * MB, expiring: 40 * MB, limit: 250 * MB }],
    }),
  );
  const user = userEvent.setup();
  render(<ServerStorage />);
  const meter = await screen.findByRole('meter', { name: '내 계정' });
  expect(meter).toHaveAttribute('aria-valuetext', '500MB 중 120MB 사용');
  expect(screen.getByText('1주일 안에 지워질 40MB')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '여행별 자세히 보기' }));
  expect(screen.getByRole('meter', { name: '오사카' })).toHaveAttribute(
    'aria-valuetext',
    '250MB 중 40MB 사용',
  );
});

it('서버에 연결할 수 없으면 알려 준다', async () => {
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('offline');
  });
  render(<ServerStorage />);
  const box = screen.getByRole('region', { name: '서버 저장 용량' });
  expect(await within(box).findByText(/서버에 연결할 수 없어요/)).toBeInTheDocument();
});

it('문서: 개수 제한 없이 붙이고, 서버 용량이 차면 기기에만 · 이름 바꾸기', async () => {
  const trip = await tripRepo.create({
    title: '오사카',
    destinations: [{ name: '오사카', kind: 'city', countryCode: 'JP' }],
    startDate: '2099-01-01',
    endDate: '2099-01-03',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  const calls: { method: string; status: number }[] = [];
  vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const status = method === 'POST' ? 507 : 200;
    calls.push({ method, status });
    return Response.json(status === 507 ? { error: 'quota_user' } : { ok: true }, { status });
  });
  const file = (n: number) => new File([`%PDF ${n}`], `t${n}.pdf`, { type: 'application/pdf' });
  for (let i = 0; i < 6; i++) await attachmentRepo.add(trip, 'b', file(i));
  const first = await attachmentRepo.add(trip, 'b', file(9));
  expect(typeof first === 'object' && first.full).toBe(true);
  expect(await db.attachments.count()).toBe(7);
  // 용량이 찬 것은 하루 동안 다시 올리지 않는다 (첫 번째만 서버에 물어봄)
  const row = (await db.attachments.get((first as { id: string }).id))!;
  expect(row.serverFullAt).toBeTruthy();
  await attachmentRepo.rename(row, '  입장권.pdf ');
  expect((await db.attachments.get(row.id))?.name).toBe('입장권.pdf');
  expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
});
