import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { resetLlmCooldown } from '../src/services/llm';

/**
 * AI 추천 — 해외는 Google 장소 먼저 + 네이버 블로그, 국내는 블로그 먼저 + Google로 채움,
 * 직접 입력 키워드, 드롭다운에서 고른 장소를 기준점으로
 */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  KAKAO_CLIENT_ID: 'kakao',
  NAVER_CLIENT_ID: 'nid',
  NAVER_CLIENT_SECRET: 'nsec',
  GROQ_API_KEY: 'groq-key',
  GOOGLE_PLACES_KEY: 'gp',
});
const ymd = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');

// 신주쿠역 근처 (기준점) / 약 1km / 약 20km
const SHINJUKU = { latitude: 35.6896, longitude: 139.7006 };
const NEAR = { latitude: 35.6938, longitude: 139.7034 };
const FAR = { latitude: 35.53, longitude: 139.7 };

let db: Db;
let app: FastifyInstance;
let sid: string;
let googleQueries: string[];
let groqUser: string[];
let aiPlaces: { name: string; category: string; sourceIds: string[] }[];

beforeEach(async () => {
  resetLlmCooldown();
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '나', 'x')").run();
  sid = createSession(db, 'u1', 't');
  googleQueries = [];
  groqUser = [];
  aiPlaces = [
    { name: '이치란 신주쿠점', category: 'food', sourceIds: ['p0', 'p1'] },
    { name: '블로그에만 있는 집', category: 'food', sourceIds: ['p0'] },
  ];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('places.googleapis.com')) {
      const q = (JSON.parse(String(init?.body)) as { textQuery: string }).textQuery;
      googleQueries.push(q);
      const places = q.endsWith('신주쿠역')
        ? [{ id: 'st', displayName: { text: '신주쿠역' }, location: SHINJUKU }]
        : [
            { id: 'g1', displayName: { text: '츠루톤탄' }, location: NEAR },
            { id: 'g2', displayName: { text: '이치란' }, location: NEAR },
            { id: 'g3', displayName: { text: '후운지' }, location: NEAR },
            { id: 'g4', displayName: { text: '먼 가게' }, location: FAR },
          ];
      return Response.json({ places });
    }
    if (url.includes('openapi.naver.com')) {
      const start = Number(new URL(url).searchParams.get('start'));
      return Response.json({
        items:
          start === 1
            ? [
                {
                  title: '신주쿠 이치란 후기',
                  description: '',
                  link: 'https://b/1',
                  postdate: ymd(2),
                },
                { title: '이치란 라멘', description: '', link: 'https://b/2', postdate: ymd(5) },
              ]
            : [],
      });
    }
    if (url.includes('api.groq.com')) {
      const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
      groqUser.push(body.messages[1]!.content);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                places: aiPlaces.map((p) => ({ ...p, adSuspect: false, summary: '진한 국물' })),
              }),
            },
          },
        ],
      });
    }
    return new Response('', { status: 404 });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const recommend = (body: object) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/ai/recommend',
    headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie: `__Host-sid=${sid}` },
    payload: body,
  });

type Place = { name: string; origin: string; mentions: number; place?: { source: string } };

describe('AI 추천 — 정보 출처와 거리', () => {
  it('해외: Google 장소가 먼저, 블로그에서 언급된 곳은 언급·요약을 붙여 맨 앞, 5km 안에 3곳이면 5km', async () => {
    const res = await recommend({
      anchor: { type: 'text', name: '신주쿠역' },
      categories: ['food'],
      domestic: false,
    });
    expect(res.statusCode).toBe(200);
    const food = res.json().categories.food as { radiusKm: number; places: Place[] };
    expect(googleQueries).toEqual(['신주쿠역', '신주쿠역 맛집']);
    expect(food.radiusKm).toBe(5);
    expect(food.places.map((p) => [p.name, p.origin])).toEqual([
      ['이치란', 'both'],
      ['츠루톤탄', 'google'],
      ['후운지', 'google'],
      // 위치를 몰라 10km 안인지 확인 안 되는 블로그만의 곳·20km 떨어진 곳은 빠짐 (2026-10-27)
    ]);
    expect(food.places[0]).toMatchObject({ mentions: 2, summary: '진한 국물' });
    // Google 정보는 AI에 보내지 않는다 (블로그 글만)
    expect(groqUser.join()).not.toContain('츠루톤탄');
  });

  it('직접 입력 키워드: 블로그·지도 검색어에 그대로, AI에는 데이터로, 결과는 custom', async () => {
    aiPlaces = [{ name: '이치란 신주쿠점', category: 'food', sourceIds: ['p0'] }];
    const res = await recommend({
      anchor: { type: 'place', name: '신주쿠역', lat: 35.6896, lng: 139.7006 },
      categories: [],
      keyword: '  라멘 ',
      domestic: false,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.keyword).toBe('라멘');
    // 고른 장소 좌표가 있으면 기준점 위치를 다시 찾지 않는다
    expect(googleQueries).toEqual(['신주쿠역 라멘']);
    expect(JSON.parse(groqUser[0]!)).toMatchObject({ keyword: '라멘' });
    expect(body.categories.custom.places[0]).toMatchObject({ name: '이치란', category: 'custom' });
  });

  it('카테고리도 키워드도 없으면 400', async () => {
    const res = await recommend({
      anchor: { type: 'text', name: '신주쿠역' },
      categories: [],
      domestic: false,
    });
    expect(res.statusCode).toBe(400);
  });

  it('Google 장소를 멈추면(API 사용량) 해외도 블로그만으로', async () => {
    db.prepare("INSERT INTO api_controls (api, paused) VALUES ('google_places_search', 1)").run();
    const res = await recommend({
      anchor: { type: 'text', name: '신주쿠역' },
      categories: ['food'],
      domestic: false,
    });
    expect(googleQueries).toEqual([]);
    const food = res.json().categories.food as { radiusKm?: number; places: Place[] };
    expect(food.radiusKm).toBeUndefined();
    expect(food.places.every((p) => p.origin === 'blog')).toBe(true);
  });
});
