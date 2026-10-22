import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { getFx } from '../../data/services/fxService';
import { loadSettings, updateSettings } from '../../data/settingsStore';

/** 서버 없음(HTML) → 무료 보조 출처: 1원 = 0.1엔 → 1엔 = 10원 */
function mockFallback(ok = true) {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.startsWith('/api/'))
      return new Response('<html>', { headers: { 'content-type': 'text/html' } });
    if (ok && url.includes('currency-api'))
      return Response.json({ date: '2026-10-22', krw: { jpy: 0.1, usd: 0.0008 } });
    return Promise.reject(new Error('offline'));
  });
}

beforeEach(async () => {
  await resetLocalDb();
  await loadSettings();
});
afterEach(() => vi.unstubAllGlobals());

describe('환율', () => {
  it('서버가 없으면 무료 출처, 그것도 안 되면 저장해 둔 값(최신 아님)', async () => {
    mockFallback();
    expect(await getFx()).toMatchObject({
      source: 'currency-api',
      stale: false,
      rates: { JPY: 10, USD: 1250 },
    });
    mockFallback(false);
    expect(await getFx()).toMatchObject({ stale: true, rates: { JPY: 10 } });
  });

  it('계산기: 키패드로 ¥3,500 → 35,000원, 수수료 켜면 반영, 위아래 바꾸기', async () => {
    mockFallback();
    const user = userEvent.setup();
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/fx?currency=JPY'] })}
      />,
    );
    expect(await screen.findByText('¥100 = 1,000원')).toBeInTheDocument();
    for (const k of ['3', '5', '0', '0']) await user.click(screen.getByRole('button', { name: k }));
    expect(screen.getByText('₩ 35,000')).toBeInTheDocument();
    updateSettings({ fxFeeEnabled: true, fxFeePercent: 2 });
    expect(await screen.findByText('₩ 35,700')).toBeInTheDocument();
    expect(screen.getByText(/수수료 2% 반영/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '위아래 통화 바꾸기' }));
    expect(screen.getByText('₩ 35,700')).toBeInTheDocument(); // 이제 위 칸(원화)
    expect(screen.getByRole('link', { name: /네이버 환율/ })).toHaveAttribute(
      'href',
      expect.stringContaining('search.naver.com'),
    );
  });
});
