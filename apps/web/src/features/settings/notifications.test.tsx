import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { usePush } from '../../data/push';

const calls: { url: string; method: string; body?: unknown }[] = [];
beforeEach(() => {
  calls.length = 0;
  localStorage.removeItem('tp-push');
  usePush.setState({
    enabled: false,
    prefs: { departure: true, entry: true, itemSoon: true, sharing: true },
  });
  const sub = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(12) },
    }),
    unsubscribe: vi.fn(async () => true),
  };
  let current: typeof sub | null = null;
  vi.stubGlobal(
    'Notification',
    Object.assign(function () {}, {
      permission: 'default',
      requestPermission: async () => 'granted',
    }),
  );
  vi.stubGlobal('PushManager', function () {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => current,
          subscribe: async () => (current = sub),
        },
      }),
    },
  });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url === '/api/push/key') return Response.json({ key: 'BAbc-_12' });
    return Response.json({ ok: true });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

it('설정 → 알림: 전체 켜기(권한·구독·서버 등록) → 필요한 것만 끄기 → 전체 끄기 (docs/20 G1)', async () => {
  const user = userEvent.setup();
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />);
  const group = await screen.findByRole('region', { name: '알림' });
  expect(within(group).getByRole('switch', { name: '일정 30분 전' })).toBeDisabled();
  await user.click(within(group).getByRole('switch', { name: '알림 받기' }));
  await waitFor(() => expect(usePush.getState().enabled).toBe(true));
  expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
    endpoint: 'https://push.example/abc',
  });

  await user.click(within(group).getByRole('switch', { name: '일정 30분 전' }));
  await waitFor(() =>
    expect(calls.filter((c) => c.method === 'PUT').at(-1)?.body).toMatchObject({
      prefs: { itemSoon: false, departure: true },
    }),
  );

  await user.click(within(group).getByRole('switch', { name: '알림 받기' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  expect(usePush.getState().enabled).toBe(false);
});
