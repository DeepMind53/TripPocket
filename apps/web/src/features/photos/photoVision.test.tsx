import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '../../data/db';
import { resetLocalDb } from '../../data/dev';
import { setLab } from '../../data/labsStore';
import { photoRepo } from '../../data/repositories/photoRepo';
import { PhotoTranslate } from '../phrases/PhotoTranslate';
import { PhotoAlbum } from '../records/PhotoAlbum';
import { ConfirmHost } from '../../shared/ui';

beforeEach(async () => {
  await resetLocalDb();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  );
});
afterEach(() => {
  for (const id of ['photoTranslate', 'photoLabels'] as const) setLab(id, false, { silent: true });
  vi.unstubAllGlobals();
});

it('사진으로 번역: 실험을 켜면 [찍기][고르기], 고르면 줄마다 한국어 (사진은 저장 안 함)', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (u: string) => {
    urls.push(String(u));
    return Response.json({
      lines: [{ text: 'ラーメン 980円', ko: '라멘 980엔' }],
      left: 19,
    });
  });
  const { rerender } = render(<PhotoTranslate />);
  expect(screen.queryByRole('region', { name: '사진으로 번역' })).toBeNull();
  setLab('photoTranslate', true, { silent: true });
  rerender(<PhotoTranslate />);
  const user = userEvent.setup();
  const pick = screen.getByRole('button', { name: '메뉴판 휴대폰 사진에서 고르기' });
  await user.upload(
    pick.querySelector('input') as HTMLInputElement,
    new File(['jpg'], 'm.jpg', { type: 'image/jpeg' }),
  );
  const sheet = await screen.findByRole('dialog', { name: '사진으로 번역' });
  expect(within(sheet).getByText('라멘 980엔')).toBeInTheDocument();
  expect(within(sheet).getByText('ラーメン 980円')).toBeInTheDocument();
  expect(urls).toEqual(['/api/vision/translate']);
  expect(await db.photos.count()).toBe(0);
});

it('사진 분류: [분류하기]를 누를 때만 안 나눈 사진을 보내고 묶음별로 보여 준다', async () => {
  setLab('photoLabels', true, { silent: true });
  for (const n of [1, 2])
    await photoRepo.add({ tripId: 't', itemId: 'i', kind: 'photo', blob: new Blob([`${n}`]) });
  await photoRepo.add({ tripId: 't', itemId: 'i', kind: 'receipt', blob: new Blob(['r']) });
  const sent: string[] = [];
  vi.stubGlobal('fetch', async (u: string) => {
    sent.push(String(u));
    return Response.json({ names: [{ name: 'Ramen', score: 0.9 }], left: 59 });
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PhotoAlbum />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: '사진 2장 분류하기' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: '음식 2' })).toBeInTheDocument());
  // 영수증은 보내지 않는다
  expect(sent).toEqual(['/api/vision/labels', '/api/vision/labels']);
  expect(screen.queryByRole('button', { name: /분류하기/ })).toBeNull();
});

it('기록 사진 모아보기: 실험을 꺼도 사진·영수증이 보이고, 일정이 지워진 사진도 눌러서 지운다 (2026-11-12)', async () => {
  // 일정 'gone'은 없다 (지운 일정) — 그 사진은 "일정 없음"
  await photoRepo.add({ tripId: 't', itemId: 'gone', kind: 'photo', blob: new Blob(['p']) });
  await photoRepo.add({ tripId: 't', itemId: 'gone', kind: 'receipt', blob: new Blob(['r']) });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PhotoAlbum />
      <ConfirmHost />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('radio', { name: '영수증 1' })).toBeInTheDocument();
  // 분류는 실험을 켰을 때만
  expect(screen.queryByRole('button', { name: /분류하기/ })).toBeNull();
  await user.click(await screen.findByRole('button', { name: '사진 1 크게 보기, 일정 없음' }));
  const sheet = await screen.findByRole('dialog', { name: '사진' });
  await user.click(within(sheet).getByRole('button', { name: '사진 지우기' }));
  await user.click(await screen.findByRole('button', { name: '삭제' }));
  await waitFor(async () => expect(await db.photos.count()).toBe(1));
});
