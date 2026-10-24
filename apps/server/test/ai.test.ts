import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { aiRoutes } from '../src/routes/ai';
import { resolveAnchor } from '../src/services/anchor';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  KAKAO_CLIENT_ID: 'kakao-rest',
  NAVER_CLIENT_ID: 'nid',
  NAVER_CLIENT_SECRET: 'nsec',
});

const ymd = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');

let calls: string[];
function mockApis() {
  calls = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${url} ${String(init?.body ?? '')}`);
    if (url.includes('dapi.kakao.com'))
      return Response.json({ documents: [{ place_name: '성수역 2호선' }] });
    if (url.includes('overpass-api'))
      return Response.json({
        elements: [
          { lat: 35.69, lon: 139.7, tags: { name: '新宿', 'name:ko': '신주쿠' } },
          { lat: 35.7, lon: 139.8, tags: { name: '遠い駅' } },
        ],
      });
    if (url.includes('openapi.naver.com')) {
      const start = Number(new URL(url).searchParams.get('start'));
      const items =
        start === 1
          ? [
              {
                title: '<b>성수</b> 맛집 A',
                description: '...',
                link: 'https://blog.naver.com/a/1',
                postdate: ymd(5),
                bloggername: 'x',
              },
              {
                title: '맛집 B',
                description: '',
                link: 'https://blog.naver.com/a/2',
                postdate: ymd(60),
                bloggername: 'y',
              },
              {
                title: '오래된 글',
                description: '',
                link: 'https://blog.naver.com/a/3',
                postdate: ymd(400),
                bloggername: 'z',
              },
            ]
          : [];
      return Response.json({ items });
    }
    return new Response('', { status: 404 });
  });
}

describe('AI 추천 ① 기준점', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('국내 좌표 → 카카오 가장 가까운 역 (노선 이름 빼고), 해외 → OSM 한국어 이름 + 역', async () => {
    mockApis();
    expect(
      await resolveAnchor({ type: 'coords', lat: 37.54456, lng: 127.05612 }, 'kakao-rest'),
    ).toBe('성수역');
    // 좌표는 소수 3자리로만 나간다
    expect(calls[0]).toContain('x=127.056&y=37.545');
    expect(await resolveAnchor({ type: 'coords', lat: 35.6896, lng: 139.7006 }, 'kakao-rest')).toBe(
      '신주쿠역',
    );
    expect(await resolveAnchor({ type: 'text', name: '  성수동 ' }, undefined)).toBe('성수동');
  });
});

describe('AI 추천 ① 수집 API', () => {
  let db: Db;
  let sid: string;
  beforeEach(() => {
    db = openDb(':memory:');
    db.prepare(
      "INSERT INTO users (id, nickname, created_at, is_admin) VALUES ('u1', 'n', 'x', 1)",
    ).run();
    sid = createSession(db, 'u1', 't');
    mockApis();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    db.close();
  });

  const post = (app: Awaited<ReturnType<typeof buildApp>>, body: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/ai/collect',
      headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie: `__Host-sid=${sid}` },
      payload: body,
    });

  it('블로그를 최신순으로 모아 기간별 개수, 12개월 넘은 글은 뺀다, 같은 요청은 캐시', async () => {
    const app = await buildApp(config, db);
    const res = await post(app, { anchor: { type: 'text', name: '성수역' }, categories: ['food'] });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.anchor).toBe('성수역');
    expect(body.categories.food.byPeriod).toEqual({ 1: 1, 3: 2, 6: 2, 12: 2 });
    expect(body.categories.food.posts[0].title).toBe('성수 맛집 A'); // 태그 제거
    const naverCalls = calls.filter((c) => c.includes('openapi.naver.com')).length;
    await post(app, { anchor: { type: 'text', name: '성수역' }, categories: ['food'] });
    expect(calls.filter((c) => c.includes('openapi.naver.com')).length).toBe(naverCalls);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/ai/recommend/usage',
          headers: { [PROXY_HEADER]: SECRET, cookie: `__Host-sid=${sid}` },
        })
      ).json(),
    ).toMatchObject({ used: 1 });
    await app.close();
  });

  it('하루 한도를 넘으면 429, 로그인 안 하면 401', async () => {
    const app = await buildApp(config, db);
    db.prepare("INSERT INTO ai_usage (user_id, date, count) VALUES ('u1', ?, 20)").run(
      new Date().toISOString().slice(0, 10),
    );
    expect(
      (await post(app, { anchor: { type: 'text', name: 'a' }, categories: ['food'] })).statusCode,
    ).toBe(429);
    const anon = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/collect',
      headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN },
      payload: {},
    });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });

  it('좌표는 서버 로그에 남지 않는다 (docs/14 §10)', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _e, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    const app = Fastify({ logger: { level: 'trace', stream: sink } });
    await app.register((await import('@fastify/cookie')).default);
    aiRoutes(app, config, db);
    await app.inject({
      method: 'POST',
      url: '/api/v1/ai/collect',
      headers: { cookie: `__Host-sid=${sid}` },
      payload: { anchor: { type: 'coords', lat: 37.54456, lng: 127.05612 }, categories: ['food'] },
    });
    const log = lines.join('\n');
    expect(log).toContain('/api/v1/ai/collect');
    expect(log).not.toMatch(/37\.54|127\.05/);
    await app.close();
  });
});
