import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { resetLlmCooldown } from '../src/services/llm';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  KAKAO_CLIENT_ID: 'kakao',
  GOOGLE_VISION_KEY: 'gv',
  GEMINI_API_KEY: 'gm',
});

let db: Db;
let app: FastifyInstance;
let sid: string;
let calls: { url: string; body: string }[];

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', 'n', 'x')").run();
  sid = createSession(db, 'u1', 't');
  resetLlmCooldown();
  calls = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const body = String(init?.body ?? '');
    calls.push({ url, body });
    if (url.includes('vision.googleapis.com')) {
      if (body.includes('LANDMARK_DETECTION'))
        return Response.json({
          responses: [
            {
              landmarkAnnotations: [
                {
                  description: 'Sensō-ji',
                  score: 0.91,
                  locations: [{ latLng: { latitude: 35.71, longitude: 139.79 } }],
                },
              ],
            },
          ],
        });
      if (body.includes('LABEL_DETECTION'))
        return Response.json({
          responses: [{ labelAnnotations: [{ description: 'Food', score: 0.97 }] }],
        });
      return Response.json({
        responses: [{ fullTextAnnotation: { text: 'ラーメン 980円\nビール 600円' } }],
      });
    }
    if (url.includes('generativelanguage.googleapis.com'))
      return Response.json({
        choices: [{ message: { content: '{"ko":["라멘 980엔","맥주 600엔"]}' } }],
      });
    return new Response('not found', { status: 404 });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const post = (path: string, cookie: string | null = `__Host-sid=${sid}`) =>
  app.inject({
    method: 'POST',
    url: path,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      'content-type': 'image/jpeg',
      ...(cookie ? { cookie } : {}),
    },
    payload: JPEG,
  });

describe('사진 기능 (실험실, ADR-0012)', () => {
  it('로그인해야 쓴다', async () => {
    for (const p of ['/api/vision/translate', '/api/vision/landmark', '/api/vision/labels'])
      expect((await post(p, null)).statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('사진으로 번역: 글자를 읽고 줄마다 한국어 (AI에는 읽은 글 줄만)', async () => {
    const res = await post('/api/vision/translate');
    expect(res.json()).toEqual({
      lines: [
        { text: 'ラーメン 980円', ko: '라멘 980엔' },
        { text: 'ビール 600円', ko: '맥주 600엔' },
      ],
      left: 19,
    });
    const ai = calls.find((c) => c.url.includes('generativelanguage'))!;
    expect(JSON.parse(JSON.parse(ai.body).messages[1].content)).toEqual({
      lines: ['ラーメン 980円', 'ビール 600円'],
    });
  });

  it('사진 속 장소: 이름과 확신도만 (좌표는 돌려주지 않는다)', async () => {
    const res = await post('/api/vision/landmark');
    expect(res.json()).toEqual({ names: [{ name: 'Sensō-ji', score: 0.91 }], left: 19 });
    expect(res.body).not.toContain('35.71');
  });

  it('사진 분류: 라벨 이름, 하루 60장 — 넘으면 429 (팝업 없음)', async () => {
    expect((await post('/api/vision/labels')).json()).toEqual({
      names: [{ name: 'Food', score: 0.97 }],
      left: 59,
    });
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    db.prepare(
      "UPDATE places_usage SET count = 60 WHERE user_id = 'u1' AND date = ? AND kind = 'vision_labels'",
    ).run(day);
    const over = await post('/api/vision/labels');
    expect(over.statusCode).toBe(429);
    expect(over.json()).toMatchObject({ error: 'vision_daily', feature: 'labels', left: 0 });
  });
});
