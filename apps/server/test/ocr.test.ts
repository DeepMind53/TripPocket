import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const base = {
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  KAKAO_CLIENT_ID: 'kakao',
};

let db: Db;
let app: FastifyInstance;
let sid: string;
let calls: { url: string; headers: Record<string, string> }[];
let googleFails = false;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

async function start(env: Record<string, string>) {
  db = openDb(':memory:');
  app = await buildApp(loadConfig({ ...base, ...env }), db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', 'n', 'x')").run();
  sid = createSession(db, 'u1', 't');
}

beforeEach(() => {
  calls = [];
  googleFails = false;
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes('vision.googleapis.com'))
      return googleFails
        ? new Response('denied', { status: 403 })
        : Response.json({
            responses: [{ fullTextAnnotation: { text: 'ラーメン 980\n合計 980' } }],
          });
    if (url.includes('cognitiveservices.azure.com'))
      return Response.json({
        readResult: { blocks: [{ lines: [{ text: '커피 4,500' }, { text: '합계 4,500' }] }] },
      });
    return new Response('not found', { status: 404 });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const ocr = (payload: Buffer, type = 'image/jpeg', cookie: string | null = `__Host-sid=${sid}`) =>
  app.inject({
    method: 'POST',
    url: '/api/ocr',
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      'content-type': type,
      ...(cookie ? { cookie } : {}),
    },
    payload,
  });

describe('영수증 글자 인식 (ADR-0012)', () => {
  it('로그인해야 쓰고, JPEG만 받는다', async () => {
    await start({ GOOGLE_VISION_KEY: 'gv' });
    expect((await ocr(JPEG, 'image/jpeg', null)).statusCode).toBe(401);
    expect((await ocr(JPEG, 'image/png')).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('Google Vision 먼저 — 키는 주소창이 아니라 머리글로, 결과 글과 남은 횟수', async () => {
    await start({ GOOGLE_VISION_KEY: 'gv' });
    const res = await ocr(JPEG);
    expect(res.json()).toEqual({ text: 'ラーメン 980\n合計 980', source: 'google', left: 19 });
    expect(calls[0]!.url).toBe('https://vision.googleapis.com/v1/images:annotate');
    expect(calls[0]!.headers['x-goog-api-key']).toBe('gv');
  });

  it('Google이 실패하면 Azure Read로, 둘 다 없으면 503 no_ocr (웹이 기기 안 인식으로)', async () => {
    await start({
      GOOGLE_VISION_KEY: 'gv',
      AZURE_VISION_ENDPOINT: 'https://tp.cognitiveservices.azure.com',
      AZURE_VISION_KEY: 'az',
    });
    googleFails = true;
    const res = await ocr(JPEG);
    expect(res.json()).toMatchObject({ text: '커피 4,500\n합계 4,500', source: 'azure' });
    expect(calls.map((c) => new URL(c.url).hostname)).toEqual([
      'vision.googleapis.com',
      'tp.cognitiveservices.azure.com',
    ]);
    await app.close();
    db.close();
    await start({});
    const none = await ocr(JPEG);
    expect(none.statusCode).toBe(503);
    expect(none.json()).toMatchObject({ error: 'no_ocr' });
  });

  it('한 사람 하루 20장 — 넘으면 429 ocr_daily, 외부 API는 부르지 않는다', async () => {
    await start({ GOOGLE_VISION_KEY: 'gv' });
    await ocr(JPEG);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    db.prepare(
      "UPDATE places_usage SET count = 20 WHERE user_id = 'u1' AND date = ? AND kind = 'ocr'",
    ).run(day);
    const over = await ocr(JPEG);
    expect(over.statusCode).toBe(429);
    expect(over.json()).toEqual({ error: 'ocr_daily', limit: 20, left: 0 });
    expect(calls).toHaveLength(1);
  });

  it('사진은 서버 어디에도 저장하지 않는다 (첨부 표에 줄이 생기지 않음)', async () => {
    await start({ GOOGLE_VISION_KEY: 'gv' });
    await ocr(JPEG);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    for (const { name } of tables) {
      if (
        name === 'places_usage' ||
        name === 'api_usage' ||
        name === 'sessions' ||
        name === 'users'
      )
        continue;
      const rows = db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
      for (const r of rows)
        for (const v of Object.values(r)) expect(v instanceof Uint8Array).toBe(false);
    }
  });
});
