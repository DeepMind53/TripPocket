import { countUse, flushUsage, screenName } from './usageStats';
import { loadUsage } from '../shared/lib/usageCount';

/** 사용 통계 (ADR-0009): 이름만 세고, 보낸 만큼만 지운다 */
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it('화면 경로의 id는 :id로 — 값이 통계에 남지 않는다', () => {
  expect(screenName('/trips/0192f000-0000-7000-8000-000000000001/day/3')).toBe(
    'screen:/trips/:id/day/:id',
  );
  expect(screenName('/')).toBe('screen:/');
});

it('정해진 형식이 아닌 이름(입력 내용 등)은 세지 않는다', () => {
  countUse('map.open.app');
  countUse('map.open.app');
  countUse('신주쿠 라멘');
  countUse('<b>');
  const days = Object.values(loadUsage());
  // 그날 처음 쓴 기능은 "쓴 기기 수"(reach.)도 한 번
  expect(days).toEqual([{ 'map.open.app': 2, 'reach.map.open.app': 1 }]);
});

it('보내고 나면 보낸 만큼 지우고, 실패하면 남긴다', async () => {
  countUse('sheet:install');
  const bodies: string[] = [];
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({}, { status: 500 });
  });
  await flushUsage();
  expect(Object.values(loadUsage())[0]).toMatchObject({ 'sheet:install': 1 });
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ ok: true });
  });
  await flushUsage();
  expect(loadUsage()).toEqual({});
  // 기기 환경은 하루 한 번 (env.*), 사용자 정보는 없다
  const sent = JSON.parse(bodies[1]!) as { days: Record<string, Record<string, number>> };
  const names = Object.keys(Object.values(sent.days)[0]!);
  expect(names).toContain('env.devices');
  expect(names).toContain('sheet:install');
});
