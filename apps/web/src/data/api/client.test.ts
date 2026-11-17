import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

/** api()는 예외를 던지지 않는다 — 부르는 화면이 try/finally 없이도 로딩 표시를 끝낼 수 있게 */
describe('api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('네트워크 오류 → offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/api/x')).resolves.toMatchObject({ ok: false, reason: 'offline' });
  });

  it('JSON이라더니 본문이 깨짐 → 예외 대신 offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"broken', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(api('/api/x')).resolves.toMatchObject({ ok: false, reason: 'offline' });
  });

  it('정상 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ a: 1 })));
    await expect(api<{ a: number }>('/api/x')).resolves.toEqual({ ok: true, data: { a: 1 } });
  });
});
