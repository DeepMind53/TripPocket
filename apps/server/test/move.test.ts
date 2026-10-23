import { moveToNewOrigin } from '../../../functions/_middleware';

const nav = { 'sec-fetch-mode': 'navigate', accept: 'text/html' };

describe('옛 주소 → trippocket.day 이동', () => {
  it('옛 주소의 화면 이동만 경로·쿼리 그대로 301', () => {
    const res = moveToNewOrigin(
      new Request('https://trippocket.pages.dev/trips/t1/plan?day=2', { headers: nav }),
    );
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe('https://trippocket.day/trips/t1/plan?day=2');
  });

  it('앱 파일·sw.js·API·로그인·새 주소·미리보기 배포는 그대로', () => {
    const keep = [
      new Request('https://trippocket.pages.dev/sw.js'),
      new Request('https://trippocket.pages.dev/assets/index-abc.js'),
      new Request('https://trippocket.pages.dev/api/me', { headers: nav }),
      new Request('https://trippocket.pages.dev/auth/kakao/callback?code=1', { headers: nav }),
      new Request('https://trippocket.day/trips', { headers: nav }),
      new Request('https://abc123.trippocket.pages.dev/', { headers: nav }),
      new Request('https://trippocket.pages.dev/api/sync', { method: 'POST', headers: nav }),
    ];
    for (const r of keep) expect(moveToNewOrigin(r)).toBeNull();
  });
});
