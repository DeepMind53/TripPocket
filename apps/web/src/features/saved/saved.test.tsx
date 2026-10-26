import { SAVED_PLACES_MAX } from '@trippocket/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { db } from '../../data/db';
import { SavedLimitError, savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { tripRepo } from '../../data/repositories/tripRepo';

beforeEach(async () => {
  await resetLocalDb();
});

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('저장한 장소 (일정과 따로)', () => {
  it('나라 칸은 많은 나라 먼저 "국기 이름", 고른 나라 장소만 아래에, 예전 저장은 도시로 나라를 채운다', async () => {
    for (const name of ['스시 잔마이', '블루보틀'])
      await savedPlaceRepo.create({ name, kind: 'food', countryCode: 'JP', cityTag: '도쿄' });
    await savedPlaceRepo.create({ name: '딘타이펑', kind: 'food', countryCode: 'TW' });
    // 나라 코드 없이 저장된 예전 장소 (2026-10-26 전)
    await savedPlaceRepo.create({ name: '이치란', kind: 'food', cityTag: '오사카' });

    const user = userEvent.setup();
    renderAt('/saved');
    const grid = await screen.findByRole('region', { name: '나라별 저장 장소' });
    await waitFor(() =>
      expect(
        within(grid)
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['🇯🇵 일본3곳', '🇹🇼 대만1곳']),
    );
    expect(await screen.findByText('이치란')).toBeInTheDocument();
    expect(screen.queryByText('딘타이펑')).not.toBeInTheDocument();
    await user.click(within(grid).getByRole('button', { name: /대만/ }));
    expect(await screen.findByText('딘타이펑')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /여행에 담기/ })).not.toBeInTheDocument();
  });

  it('나라가 9개를 넘으면 + 더보기로 펼친다', async () => {
    const codes = ['JP', 'TW', 'TH', 'VN', 'PH', 'US', 'FR', 'IT', 'ES', 'DE', 'GB'];
    for (const [n, cc] of codes.entries())
      for (let k = 0; k < codes.length - n; k++)
        await savedPlaceRepo.create({ name: `${cc}${k}`, kind: 'place', countryCode: cc });
    const user = userEvent.setup();
    renderAt('/saved');
    const grid = await screen.findByRole('region', { name: '나라별 저장 장소' });
    await waitFor(() =>
      expect(within(grid).getAllByRole('button', { pressed: false }).length).toBe(8),
    );
    expect(within(grid).queryByRole('button', { name: /영국/ })).not.toBeInTheDocument();
    await user.click(within(grid).getByRole('button', { name: '+ 더보기 (2개 나라)' }));
    expect(within(grid).getByRole('button', { name: /영국/ })).toBeInTheDocument();
  });

  it(`한 사람 ${SAVED_PLACES_MAX}곳까지`, async () => {
    await db.savedPlaces.bulkAdd(
      Array.from({ length: SAVED_PLACES_MAX }, (_, n) => ({
        id: `s${n}`,
        name: `p${n}`,
        kind: 'place' as const,
        createdAt: 'x',
        updatedAt: 'x',
        dirty: 0 as const,
      })),
    );
    await expect(savedPlaceRepo.create({ name: '하나 더', kind: 'place' })).rejects.toBeInstanceOf(
      SavedLimitError,
    );
  });

  it('일정 추가: 그 여행 나라에 저장한 곳만 골라 넣는다', async () => {
    const trip = await tripRepo.create({
      timezone: 'Asia/Tokyo',
      cover: {},
      title: '도쿄 여행',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2099-01-01',
      endDate: '2099-01-03',
    });
    await savedPlaceRepo.create({
      name: '블루보틀',
      kind: 'cafe',
      countryCode: 'JP',
      address: '기요스미',
    });
    await savedPlaceRepo.create({ name: '딘타이펑', kind: 'food', countryCode: 'TW' });
    const user = userEvent.setup();
    renderAt(`/trips/${trip.id}/plan?day=1`);
    await user.click(await screen.findByRole('button', { name: '일정 추가' }));
    const form = await screen.findByRole('dialog', { name: '일정 추가' });
    await user.click(
      await within(form).findByRole('button', { name: /저장한 장소에서 고르기 · 1/ }),
    );
    expect(within(form).queryByText('딘타이펑')).not.toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: /블루보틀/ }));
    expect(within(form).getByLabelText('이름')).toHaveValue('블루보틀');
    expect(within(form).getByLabelText('주소')).toHaveValue('기요스미');
    expect(within(form).getByRole('button', { name: '카페', pressed: true })).toBeInTheDocument();
  });
});
