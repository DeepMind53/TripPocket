// 통합 테스트: 실제 서버 코드(메모리 DB) ↔ 실제 웹 동기화 엔진. 기기 여러 대를 "DB 초기화"로 흉내 낸다
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp, PROXY_HEADER } from '../../../server/src/app';
import { createSession } from '../../../server/src/auth/session';
import { loadConfig } from '../../../server/src/config';
import { openDb } from '../../../server/src/db/database';
import { useAuth } from '../../src/data/authStore';
import { db } from '../../src/data/db';
import { resetLocalDb } from '../../src/data/dev';
import { checklistRepo } from '../../src/data/repositories/checklistRepo';
import { tripRepo } from '../../src/data/repositories/tripRepo';
import {
  chooseAccountData,
  needsAccountChoice,
  syncNow,
  useSync,
} from '../../src/data/sync/syncEngine';

const ORIGIN = 'http://localhost';
const SECRET = 'x'.repeat(40);
const serverDb = openDb(':memory:');
let app: Awaited<ReturnType<typeof buildApp>>;
let cookie = '';

beforeAll(async () => {
  app = await buildApp(
    loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET }),
    serverDb,
  );
  serverDb.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '나', 'x')").run();
  cookie = `__Host-sid=${createSession(serverDb, 'u1', 'test')}`;
  // 브라우저 fetch → Pages 프록시 → 서버 (inject)
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const res = await app.inject({
      method: (init.method ?? 'GET') as 'GET',
      url,
      headers: {
        ...(init.headers as Record<string, string>),
        cookie,
        origin: ORIGIN,
        [PROXY_HEADER]: SECRET,
      },
      ...(init.body ? { payload: String(init.body) } : {}),
    });
    return new Response(res.body, {
      status: res.statusCode,
      headers: { 'content-type': String(res.headers['content-type'] ?? '') },
    });
  });
  useAuth.setState({
    status: 'user',
    me: { id: 'u1', nickname: '나', createdAt: '', providers: [] },
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await app.close();
});

const tokyo = {
  title: '도쿄',
  destinations: [{ name: '도쿄', kind: 'city' as const, countryCode: 'JP' }],
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  timezone: 'Asia/Tokyo',
  cover: {},
};

/** 새 기기: 기기 DB를 비우고 같은 계정으로 */
async function newDevice() {
  await resetLocalDb();
  await needsAccountChoice('u1');
}

describe('기기 사이 동기화', () => {
  it('폰에서 만든 여행 → PC에서 받고, PC에서 고친 것·지운 것 → 새 기기에서 받는다', async () => {
    // 폰: 로그인 전에 만든 여행 → 첫 로그인에서 "올리기"
    await resetLocalDb();
    const trip = await tripRepo.create(tokyo);
    expect(await needsAccountChoice('u1')).toBe(true);
    await chooseAccountData('u1', 'upload');
    await syncNow();
    expect(useSync.getState().state).toBe('idle');
    expect((await db.trips.get(trip.id))?.dirty).toBe(0);
    expect((await db.trips.get(trip.id))?.rev).toBeGreaterThan(0);

    // PC
    await newDevice();
    await syncNow();
    expect((await tripRepo.listActive()).map((t) => t.title)).toEqual(['도쿄']);
    await tripRepo.update(trip.id, { title: '도쿄 가을여행' });
    const other = await tripRepo.create({ ...tokyo, title: '오사카' });
    await tripRepo.softDelete(other.id);
    await syncNow();

    // 새 기기
    await newDevice();
    await syncNow();
    expect((await tripRepo.listActive()).map((t) => t.title)).toEqual(['도쿄 가을여행']);
  });

  it('올리는 사이 또 고친 행은 다시 올라가 최종값이 서버에 남는다', async () => {
    await newDevice();
    await syncNow();
    const [trip] = await tripRepo.listActive();
    await tripRepo.update(trip!.id, { title: 'A' });
    // 올리는 도중(요청을 보낸 뒤, 응답 전)에 고침
    const realFetch = globalThis.fetch;
    let edited = false;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url === '/api/sync/push' && !edited) {
        edited = true;
        await tripRepo.update(trip!.id, { title: 'B' });
      }
      return realFetch(url, init);
    });
    await syncNow();
    vi.stubGlobal('fetch', realFetch);
    // 같은 동기화 안에서 다시 올라가 최종값(B)이 서버에 남는다
    expect((await db.trips.get(trip!.id))?.dirty).toBe(0);
    await newDevice();
    await syncNow();
    expect((await tripRepo.listActive())[0]?.title).toBe('B');
  });

  it('개인별 준비 목록 전에 받은 준비물: 한 번 다시 받아 만든 사람을 채우고, 받을 수 없는 일행 것은 지운다', async () => {
    await newDevice();
    await syncNow();
    const [trip] = await tripRepo.listActive();
    const mine = await checklistRepo.add(trip!.id, 'packing', { text: '여권' });
    await syncNow();
    // 업데이트 전 상태 흉내: 내 행에 만든 사람이 없고, 예전에 받은 일행 행(서버에선 이제 안 내려옴)이 남아 있음
    await db.checklistItems.update(mine.id, { ownerId: undefined });
    await db.checklistItems.add({
      id: 'old-friend',
      tripId: trip!.id,
      list: 'packing',
      text: '일행 것',
      checked: false,
      order: 'z0',
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
      rev: 1,
      dirty: 0,
    });
    await db.syncState.delete('ownerFill1');
    await syncNow();
    expect((await db.checklistItems.get(mine.id))?.ownerId).toBe('u1');
    expect(await db.checklistItems.get('old-friend')).toBeUndefined();
    expect((await db.syncState.get('ownerFill1'))?.value).toBe(true);
  });
});
