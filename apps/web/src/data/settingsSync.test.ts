import { waitFor } from '@testing-library/react';
import { formatMonthDay, formatPeriod } from '../shared/lib/dateFormat';
import { useAuth } from './authStore';
import { resetLocalDb } from './dev';
import { settingsRepo } from './repositories/settingsRepo';
import { loadSettings, SETTINGS_META_KEY, updateSettings, useSettings } from './settingsStore';
import { syncSettings } from './settingsSync';

const calls: { method: string; body: unknown }[] = [];
let server: { data: object | null; updatedAt: string | null };

beforeEach(async () => {
  await resetLocalDb();
  await loadSettings();
  calls.length = 0;
  server = { data: null, updatedAt: null };
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body
      ? (JSON.parse(String(init.body)) as { data: object; updatedAt: string })
      : null;
    calls.push({ method, body });
    if (method === 'PUT' && body && (!server.updatedAt || server.updatedAt < body.updatedAt))
      server = { data: body.data, updatedAt: body.updatedAt };
    return Response.json(server);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
  updateSettings({ dateFormat: 'dot' });
});

describe('설정을 계정과 맞추기', () => {
  it('바꾸면 기기에 바로 적용하고 계정에 올린다 (기기별 설정인 테마는 올리지 않음)', async () => {
    updateSettings({ dateFormat: 'korean', theme: 'dark' });
    expect(useSettings.getState().dateFormat).toBe('korean');
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!.body as { data: Record<string, unknown> };
    expect(put.data.dateFormat).toBe('korean');
    expect(put.data).not.toHaveProperty('theme');
    await waitFor(async () =>
      expect(await settingsRepo.get(SETTINGS_META_KEY, null)).toMatchObject({ dirty: false }),
    );
  });

  it('서버에 닿지 않으면 "안 올림"으로 남겨 두었다가 다시 연결되면 올린다', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    updateSettings({ planMapOpen: true });
    await waitFor(async () =>
      expect(await settingsRepo.get(SETTINGS_META_KEY, null)).toMatchObject({ dirty: true }),
    );
    vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', body: init?.body });
      const b = JSON.parse(String(init?.body ?? '{}')) as { data?: object; updatedAt?: string };
      return Response.json({ data: b.data ?? null, updatedAt: b.updatedAt ?? null });
    });
    await syncSettings();
    expect(calls.some((c) => c.method === 'PUT')).toBe(true);
    expect(await settingsRepo.get(SETTINGS_META_KEY, null)).toMatchObject({ dirty: false });
  });

  it('다른 기기에서 나중에 바꾼 설정을 받는다 (기기별 설정은 그대로)', async () => {
    updateSettings({ theme: 'dark' });
    server = {
      data: { dateFormat: 'korean', aiCats: ['play'], theme: 'light' },
      updatedAt: '2030-01-01T00:00:00.000Z',
    };
    await syncSettings();
    expect(useSettings.getState()).toMatchObject({
      dateFormat: 'korean',
      aiCats: ['play'],
      theme: 'dark',
    });
  });
});

describe('날짜 표시 형식', () => {
  it('10.27 (화) / 10월 27일 (화)', () => {
    updateSettings({ dateFormat: 'dot' });
    expect(formatMonthDay('2026-10-27')).toBe('10.27 (화)');
    updateSettings({ dateFormat: 'korean' });
    expect(formatMonthDay('2026-10-27')).toBe('10월 27일 (화)');
    expect(formatPeriod('2026-10-27', '2026-10-31')).toBe('2026년 10월 27일 – 10월 31일');
  });
});
