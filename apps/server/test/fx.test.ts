import { buildApp, PROXY_HEADER } from '../src/app';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db/database';
import { fetchExim, latestFx } from '../src/services/fx';

const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: 'https://a.dev',
  PROXY_SECRET: 's'.repeat(40),
});

describe('환율 (수출입은행)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('고시를 받아 1단위 원화로 저장하고, 로그인 없이 최신 값을 준다', async () => {
    const db = openDb(':memory:');
    let asked = '';
    vi.stubGlobal('fetch', async (url: string) => {
      asked = url;
      return Response.json([
        { result: 1, cur_unit: 'JPY(100)', deal_bas_r: '912.34' },
        { result: 1, cur_unit: 'USD', deal_bas_r: '1,377.5' },
        { result: 1, cur_unit: 'KRW', deal_bas_r: '1' },
      ]);
    });
    // 2026-10-23(금) 12:00 KST
    expect(await fetchExim(db, 'KEY', new Date('2026-10-23T03:00:00Z'))).toBe(2);
    expect(asked).toContain('searchdate=20261023');
    expect(latestFx(db)).toMatchObject({ date: '2026-10-23', rates: { JPY: 9.1234, USD: 1377.5 } });

    const app = await buildApp(config, db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/fx/latest',
      headers: { [PROXY_HEADER]: 's'.repeat(40) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.json().rates.JPY).toBe(9.1234);
    await app.close();
  });

  it('주말·고시 전 빈 응답이면 아무것도 바꾸지 않는다', async () => {
    const db = openDb(':memory:');
    vi.stubGlobal('fetch', async () => Response.json([]));
    expect(await fetchExim(db, 'KEY')).toBe(0);
    expect(latestFx(db)).toBeNull();
  });
});
