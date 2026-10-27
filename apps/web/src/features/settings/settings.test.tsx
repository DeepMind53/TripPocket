import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import { loadSettings, updateSettings, useSettings } from '../../data/settingsStore';
import { formatTime } from '../../shared/lib/dateFormat';
import { openDirectionsDirect } from '../common/openDirections';

beforeEach(async () => {
  await resetLocalDb();
  await loadSettings();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.fontSize = '';
});

describe('설정 화면', () => {
  it('바꾸면 바로 적용되고 저장된다, 섹션별 기본값 되돌리기', async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />,
    );

    const display = await screen.findByRole('region', { name: '화면' });
    await user.click(within(display).getByRole('radio', { name: '다크' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(within(display).getByRole('radio', { name: /오전·오후/ }));
    expect(useSettings.getState().timeFormat).toBe('12h');
    await waitFor(async () =>
      expect(await settingsRepo.get<{ theme: string }>('settings', { theme: '' })).toMatchObject({
        theme: 'dark',
        timeFormat: '12h',
      }),
    );

    await user.click(within(display).getByRole('button', { name: '기본값으로 되돌리기' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(useSettings.getState().timeFormat).toBe('24h');

    // 백업 알림 스테퍼: 14 → 21일
    const data = screen.getByRole('region', { name: '데이터' });
    await user.click(within(data).getByRole('button', { name: /늘리기|더하기|\+/ }));
    expect(useSettings.getState().backupReminderDays).toBe(21);
  });
});

describe('설정 저장소', () => {
  it('예전 길찾기 이동수단 설정을 옮겨 오고, 잘못된 값은 기본값', async () => {
    await settingsRepo.set('directions', { mode: 'walk' });
    await settingsRepo.set('settings', { fontScale: 5, theme: 'light' });
    await loadSettings();
    const s = useSettings.getState();
    expect(s.travelMode).toBe('walk');
    expect(s.fontScale).toBe(1);
    expect(s.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('글자 크기는 화면 전체 배율', () => {
    updateSettings({ fontScale: 1.15 });
    expect(document.documentElement.style.fontSize).toBe('115%');
  });

  it('시간 표기', () => {
    expect(formatTime('09:05', '24h')).toBe('09:05');
    expect(formatTime('09:05', '12h')).toBe('오전 9:05');
    expect(formatTime('00:30', '12h')).toBe('오전 12:30');
    expect(formatTime('13:00', '12h')).toBe('오후 1:00');
  });

  it('해외는 늘 Google, 국내는 고른 네이버·카카오 (매번 묻기면 시트) — 2026-10-27', () => {
    // PC(마우스) 환경으로 — 웹 링크를 새 탭으로 연다
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const tokyo = { name: '센소지', coords: { lat: 35.71, lng: 139.79 } };
    const seoul = { name: '경복궁', coords: { lat: 37.58, lng: 126.98 } };
    updateSettings({ directionsApp: 'ask', travelMode: 'walk' });
    // 해외: 묻지 않고 Google
    expect(openDirectionsDirect(tokyo)).toBe(true);
    expect(open.mock.calls[0]?.[0]).toMatch(/google\.com\/maps.*travelmode=walking/);
    // 국내: 매번 묻기면 시트
    expect(openDirectionsDirect(seoul)).toBe(false);
    updateSettings({ directionsApp: 'kakao' });
    expect(openDirectionsDirect(seoul)).toBe(true);
    expect(open.mock.calls[1]?.[0]).toMatch(/map\.kakao\.com/);
    open.mockRestore();
  });
});
