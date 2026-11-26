import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** sw-template.js의 phraseAudio()만 꺼내 시험 (서비스 워커 전체는 브라우저에서만 돈다) */
function loadPhraseAudio(store: Map<string, Response>, net: (u: never) => Response) {
  const src = readFileSync(resolve(__dirname, 'sw-template.js'), 'utf8');
  const start = src.indexOf('async function phraseAudio');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 2);
  const caches = {
    open: async () => ({
      match: async (k: string) => store.get(k)?.clone(),
      put: async (k: string, r: Response) => void store.set(k, r),
    }),
  };
  const fetch = async (u: never) => net(u);
  return new Function('caches', 'fetch', `${body}; return phraseAudio;`)(caches, fetch) as (
    req: Request,
    url: URL,
  ) => Promise<Response>;
}

const bytes = new Uint8Array(100).map((_, i) => i);
const mp3 = () => new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } });

describe('서비스 워커 회화 음성 (2026-11-26 아이폰 소리 안 남)', () => {
  it('Range 요청이면 저장본에서 그 조각만 206으로 (아이폰 사파리는 206이 아니면 안 튼다)', async () => {
    const store = new Map([['/phrases/ja-1.mp3', mp3()]]);
    const fn = loadPhraseAudio(store, () => {
      throw new Error('네트워크 쓰면 안 됨');
    });
    const url = new URL('https://x.dev/phrases/ja-1.mp3');
    const res = await fn(new Request(url, { headers: { Range: 'bytes=0-1' } }), url);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1/100');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0, 1]);
    const all = await fn(new Request(url, { headers: { Range: 'bytes=0-' } }), url);
    expect(all.headers.get('Content-Range')).toBe('bytes 0-99/100');
    expect(all.headers.get('Content-Length')).toBe('100');
  });

  it('아직 안 받은 소리·받기 목록은 서버로 그대로 보낸다 (저장은 앱의 [받기]만, 중국어 학습 앱과 같게)', async () => {
    const store = new Map<string, Response>();
    const asked: string[] = [];
    const fn = loadPhraseAudio(store, (u: unknown) => {
      asked.push(u instanceof Request ? new URL(u.url).pathname : String(u));
      return new Response('net', { status: 206 });
    });
    const url = new URL('https://x.dev/phrases/th-2.mp3');
    const res = await fn(new Request(url, { headers: { Range: 'bytes=90-' } }), url);
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('net');
    expect(store.size).toBe(0);
    const list = new URL('https://x.dev/phrases/manifest.json');
    await fn(new Request(list), list);
    expect(asked).toEqual(['/phrases/th-2.mp3', '/phrases/manifest.json']);
  });
});
