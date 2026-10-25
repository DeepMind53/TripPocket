import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
let db: Db;
let app: FastifyInstance;
let dataDir = '';
const sid: Record<string, string> = {};
const h = (who: string, extra: Record<string, string> = {}) => ({
  [PROXY_HEADER]: SECRET,
  origin: ORIGIN,
  cookie: `__Host-sid=${sid[who]}`,
  ...extra,
});

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'tp-sug-'));
  db = openDb(':memory:');
  app = await buildApp(
    loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET, DATA_DIR: dataDir }),
    db,
  );
  for (const n of ['A', 'U']) {
    db.prepare('INSERT INTO users (id, nickname, created_at, is_admin) VALUES (?, ?, ?, ?)').run(
      `u-${n}`,
      n === 'A' ? '관리자' : '여행자',
      'x',
      n === 'A' ? 1 : 0,
    );
    sid[n] = createSession(db, `u-${n}`, 't');
  }
});
afterEach(async () => {
  await app.close();
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('개선 제안 (사용자 요청 2026-10-25)', () => {
  it('글 + 사진 1장(10MB) → 관리자가 보고 답장, 제안한 사람은 답장을 본다', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suggestions',
      headers: h('U'),
      payload: { body: '지도에 즐겨찾기를 보여 주세요' },
    });
    const { id } = res.json() as { id: string };
    const img = await app.inject({
      method: 'POST',
      url: `/api/suggestions/${id}/image`,
      headers: h('U', { 'content-type': 'image/png' }),
      payload: Buffer.from('png'),
    });
    expect(img.statusCode).toBe(200);
    const big = await app.inject({
      method: 'POST',
      url: `/api/suggestions/${id}/image`,
      headers: h('U', { 'content-type': 'image/png' }),
      payload: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    expect(big.statusCode).toBe(413);

    // 일반 사용자는 관리자 목록 불가
    expect(
      (await app.inject({ method: 'GET', url: '/api/admin/suggestions', headers: h('U') }))
        .statusCode,
    ).toBe(403);
    const list = (
      await app.inject({ method: 'GET', url: '/api/admin/suggestions', headers: h('A') })
    ).json();
    expect(list.suggestions[0]).toMatchObject({
      author: '여행자',
      body: '지도에 즐겨찾기를 보여 주세요',
      hasImage: true,
      status: 'new',
    });
    const pic = await app.inject({
      method: 'GET',
      url: `/api/admin/suggestions/${id}/image`,
      headers: h('A'),
    });
    expect(pic.body).toBe('png');

    await app.inject({
      method: 'POST',
      url: `/api/admin/suggestions/${id}`,
      headers: h('A'),
      payload: { status: 'done', reply: '다음 업데이트에 넣을게요' },
    });
    const mine = (
      await app.inject({ method: 'GET', url: '/api/suggestions/mine', headers: h('U') })
    ).json();
    expect(mine.suggestions[0]).toMatchObject({
      status: 'done',
      reply: '다음 업데이트에 넣을게요',
    });
  });

  it('빈 글·너무 긴 글은 400, 남의 제안에는 사진을 못 붙임', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/suggestions',
          headers: h('U'),
          payload: { body: '  ' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/suggestions',
          headers: h('U'),
          payload: { body: 'x'.repeat(2001) },
        })
      ).statusCode,
    ).toBe(400);
    const { id } = (
      await app.inject({
        method: 'POST',
        url: '/api/suggestions',
        headers: h('U'),
        payload: { body: '좋아요' },
      })
    ).json() as { id: string };
    const other = await app.inject({
      method: 'POST',
      url: `/api/suggestions/${id}/image`,
      headers: h('A', { 'content-type': 'image/png' }),
      payload: Buffer.from('x'),
    });
    expect(other.statusCode).toBe(404);
  });
});
