import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import {
  parseGdacs,
  parseMofa,
  parseUsgs,
  resetAlertCache,
  usgsCountry,
} from '../src/services/alerts';

const NOW = Date.parse('2026-10-27T00:00:00Z');

describe('특보 출처 읽기', () => {
  it('GDACS: 주황·빨강만, 피해 나라마다 하나씩, 끝난 지 3일 넘으면 뺀다', () => {
    const ev = (id: number, level: string, todate: string, iscurrent = 'false') => ({
      properties: {
        eventtype: 'TC',
        eventid: id,
        name: `Tropical Cyclone ${id}`,
        alertlevel: level,
        iscurrent,
        fromdate: '2026-10-20T00:00:00',
        todate,
        url: { report: `https://www.gdacs.org/report.aspx?eventid=${id}` },
        affectedcountries: [{ iso2: 'JP' }, { iso2: 'TW' }],
      },
    });
    const out = parseGdacs(
      {
        features: [
          ev(1, 'Red', '2026-10-26T00:00:00'),
          ev(2, 'Green', '2026-10-26T00:00:00'),
          ev(3, 'Orange', '2026-10-01T00:00:00'),
          ev(4, 'Orange', '2026-10-01T00:00:00', 'true'),
        ],
      },
      NOW,
    );
    expect(out.map((a) => [a.id, a.level])).toEqual([
      ['gdacs-TC-1-JP', 'red'],
      ['gdacs-TC-1-TW', 'red'],
      ['gdacs-TC-4-JP', 'orange'],
      ['gdacs-TC-4-TW', 'orange'],
    ]);
    expect(out[0]).toMatchObject({ kind: 'cyclone', until: '2026-10-26T00:00:00Z' });
  });

  it('USGS: 위치 설명 끝에서 나라를 읽는다', () => {
    expect(usgsCountry('45 km E of Hualien City, Taiwan')).toBe('TW');
    expect(usgsCountry('Bonin Islands, Japan region')).toBe('JP');
    expect(usgsCountry('south of the Fiji Islands')).toBe('FJ');
    expect(usgsCountry('81 km SSE of Akutan, Alaska')).toBe('US');
    expect(usgsCountry('10 km NW of The Geysers, CA')).toBe('US');
    expect(usgsCountry('56 km S of Kuril’sk, Russia')).toBe('RU');
    expect(usgsCountry('Mid-Indian Ridge')).toBeUndefined();
  });

  it('USGS: 규모 5.5 이상·72시간 안만, 규모로 등급', () => {
    const f = (id: string, mag: number, hoursAgo: number) => ({
      id,
      properties: {
        mag,
        place: '10 km E of Tokyo, Japan',
        time: NOW - hoursAgo * 3_600_000,
        url: `https://earthquake.usgs.gov/${id}`,
      },
    });
    const out = parseUsgs(
      {
        features: [f('a', 7.1, 1), f('b', 6.2, 2), f('c', 5.6, 3), f('d', 5.0, 1), f('e', 6.5, 80)],
      },
      NOW,
    );
    expect(out.map((a) => [a.id, a.level, a.country])).toEqual([
      ['usgs-a', 'red', 'JP'],
      ['usgs-b', 'orange', 'JP'],
      ['usgs-c', 'info', 'JP'],
    ]);
  });

  it('외교부: 여행경보 단계별 등급 + 철수·금지 권고', () => {
    const wrap = (item: object[]) => ({ response: { body: { items: { item } } } });
    const out = parseMofa(
      wrap([
        {
          country_iso_alp2: 'PH',
          country_nm: '필리핀',
          alarm_lvl: '4',
          region_ty: '일부',
          remark: '술루',
        },
        {
          country_iso_alp2: 'VN',
          country_nm: '베트남',
          alarm_lvl: '1',
          region_ty: '전체',
          remark: '전 지역',
        },
      ]),
      wrap([
        { country_iso_alp2: 'GH', evacuate_rcmnd_remark: null, forbidden_rcmnd_remark: null },
        {
          country_iso_alp2: 'NP',
          country_nm: '네팔',
          evacuate_rcmnd_remark: '룸비니 주',
          evacuate_region_ty: '일부',
        },
      ]),
    );
    expect(out.map((a) => [a.id, a.level, a.whole])).toEqual([
      ['mofa-PH-4', 'red', false],
      ['mofa-VN-1', 'info', true],
      ['mofa-NP-evacuate', 'red', false],
    ]);
  });
});

describe('GET /api/alerts', () => {
  const SECRET = 's'.repeat(40);
  const ORIGIN = 'https://a.dev';
  let db: Db;
  let app: FastifyInstance;
  let sid: string;
  let urls: string[];

  const setup = async (env: Record<string, string> = {}) => {
    const config = loadConfig({
      NODE_ENV: 'test',
      WEB_ORIGIN: ORIGIN,
      PROXY_SECRET: SECRET,
      KAKAO_CLIENT_ID: 'kakao',
      ...env,
    });
    db = openDb(':memory:');
    app = await buildApp(config, db);
    db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', 'n', 'x')").run();
    sid = createSession(db, 'u1', 't');
  };

  beforeEach(() => {
    resetAlertCache();
    urls = [];
    vi.stubGlobal('fetch', async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('gdacs'))
        return Response.json({
          features: [
            {
              properties: {
                eventtype: 'EQ',
                eventid: 9,
                name: 'Earthquake',
                alertlevel: 'Orange',
                iscurrent: 'true',
                affectedcountries: [{ iso2: 'JP' }],
              },
            },
          ],
        });
      if (url.includes('usgs')) return Response.json({ features: [] });
      if (url.includes('TravelAlarmService2'))
        return Response.json({
          response: {
            body: {
              items: { item: [{ country_iso_alp2: 'JP', alarm_lvl: '3', region_ty: '일부' }] },
            },
          },
        });
      if (url.includes('SptravelWarningServiceV2'))
        return Response.json({ response: { body: { items: { item: [] } } } });
      return new Response('no', { status: 404 });
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await app.close();
    db.close();
  });

  const get = (q: string, cookie: string | null = `__Host-sid=${sid}`) =>
    app.inject({
      method: 'GET',
      url: `/api/alerts${q}`,
      headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    });

  it('로그인해야 쓸 수 있다 (인가 누락 방지)', async () => {
    await setup();
    expect((await get('?countries=JP', null)).statusCode).toBe(401);
    expect(urls).toEqual([]);
  });

  it('나라 코드가 이상하면 400', async () => {
    await setup();
    expect((await get('?countries=JPN')).statusCode).toBe(400);
    expect((await get('')).statusCode).toBe(400);
  });

  it('고른 나라 것만, 외교부 키가 없으면 빠진 출처로 알린다', async () => {
    await setup();
    const res = await get('?countries=jp');
    expect(res.statusCode).toBe(200);
    const body = res.json<{ alerts: { id: string }[]; missing: string[] }>();
    expect(body.alerts.map((a) => a.id)).toEqual(['gdacs-EQ-9-JP']);
    expect(body.missing).toEqual(['mofa']);
  });

  it('외교부 키가 있으면 여행경보도, 다시 물으면 출처를 다시 부르지 않는다', async () => {
    await setup({ DATA_GO_KR_KEY: 'k' });
    const body = (await get('?countries=JP,TW')).json<{ alerts: { id: string }[] }>();
    expect(body.alerts.map((a) => a.id)).toEqual(['mofa-JP-3', 'gdacs-EQ-9-JP']);
    const n = urls.length;
    await get('?countries=JP');
    expect(urls.length).toBe(n);
  });
});
