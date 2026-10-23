import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { localTimeLabel } from '../../shared/hooks/useMinuteClock';

beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-labs');
});

describe('실험실', () => {
  it('마이 → 실험실에서 켜고 끄면 이 기기에 저장', async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me'] })} />);
    await user.click(await screen.findByRole('link', { name: '실험실' }));
    const sw = await screen.findByRole('switch', { name: /다음 장소까지 거리/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(JSON.parse(localStorage.getItem('tp-labs')!)).toEqual({ legDistance: true });
    expect(screen.getByRole('switch', { name: /화면 켜짐 유지/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /현지 시각 표시/ })).toBeInTheDocument();
  });

  it('현지 시각: 시간대가 기기와 다를 때만', () => {
    const t = (_k: string, o: { time: string }) => `현지 ${o.time}`;
    const now = new Date('2026-10-24T03:05:00Z');
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(localTimeLabel(device, now, t)).toBeNull();
    const other = device === 'Asia/Bangkok' ? 'Asia/Tokyo' : 'Asia/Bangkok';
    expect(localTimeLabel(other, now, t)).toBe(
      other === 'Asia/Bangkok' ? '현지 10:05' : '현지 12:05',
    );
    expect(localTimeLabel('Not/AZone', now, t)).toBeNull();
  });
});
