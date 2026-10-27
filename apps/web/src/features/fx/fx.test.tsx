import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';
import { getFx } from '../../data/services/fxService';
import { loadSettings, updateSettings } from '../../data/settingsStore';

/** 서버 없음(HTML) → 무료 보조 출처: 1원 = 0.1엔 → 1엔 = 10원 */
function mockFallback(ok = true) {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.startsWith('/api/'))
      return new Response('<html>', { headers: { 'content-type': 'text/html' } });
    if (ok && url.includes('currency-api'))
      return Response.json({ date: '2026-10-22', krw: { jpy: 0.1, usd: 0.0008, twd: 0.0232 } });
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
    // 보조 출처는 하루 한 번: 같은 날에는 받아 둔 값을 다시 쓴다 (새로 부르지 않음)
    mockFallback(false);
    expect(await getFx()).toMatchObject({ stale: false, rates: { JPY: 10 } });
    // 다음 날 아무 데도 닿지 않으면 저장해 둔 값(최신 아님)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 86_400_000);
    expect(await getFx()).toMatchObject({ stale: true, rates: { JPY: 10 } });
    vi.useRealTimers();
  });

  it('보조 출처 값이 며칠 전 날짜면 같은 날이어도 한 시간 뒤 다시 받는다', async () => {
    mockFallback();
    await getFx(); // 2026-10-22 값 (오래됨)
    vi.stubGlobal('fetch', async (url: string) =>
      url.startsWith('/api/')
        ? new Response('<html>', { headers: { 'content-type': 'text/html' } })
        : Response.json({ date: new Date().toISOString().slice(0, 10), krw: { jpy: 0.2 } }),
    );
    // 한 시간 안에는 그대로
    expect((await getFx())?.rates.JPY).toBe(10);
    // 통화를 골라 바로 새로 받기(force)는 1분만 지나면 새 값
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    expect((await getFx({ force: true }))?.rates.JPY).toBe(5);
    vi.useRealTimers();
  });

  it('수출입은행에 없는 통화(대만달러)는 국제 시세로 채운다', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url === '/api/fx/latest'
        ? Response.json({
            source: 'koreaexim',
            date: '2026-10-23',
            fetchedAt: '',
            rates: { JPY: 9.1 },
          })
        : Response.json({ date: '2026-10-24', krw: { jpy: 0.11, twd: 0.0232 } }),
    );
    const fx = await getFx();
    expect(fx?.rates.JPY).toBe(9.1);
    expect(fx?.rates.TWD).toBeCloseTo(43.1, 1);
    expect(fx?.fallback).toEqual({ codes: ['TWD'], date: '2026-10-24' });
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

describe('환율 처음 통화', () => {
  beforeEach(async () => {
    await resetLocalDb();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('여행 화면이 아닌 곳에서 열면 다가오는 여행 나라 통화가 먼저 (대만 → TWD)', async () => {
    mockFallback();
    const start = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
    await tripRepo.create({
      title: '타이베이',
      destinations: [{ name: '타이베이', kind: 'city', countryCode: 'TW' }],
      startDate: start,
      endDate: end,
      timezone: 'Asia/Taipei',
      cover: {},
    });
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/fx'] })} />);
    expect((await screen.findAllByText(/TWD/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/JPY/)).not.toBeInTheDocument();
    // 이름은 "대만 달러" (약어 두 번·"신 타이완 달러" 아님), 네이버는 약어로 검색해야 환율 계산기가 뜬다
    expect((await screen.findAllByText('대만 달러 TWD')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /네이버 환율/ })).toHaveAttribute(
      'href',
      expect.stringContaining(`query=${encodeURIComponent('TWD 환율')}`),
    );
  });
});
