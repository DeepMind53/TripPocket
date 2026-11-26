/** 회화 소리 받기 — 중국어 학습 앱과 같게: 받기 목록 → 크기 확인 → 기기 저장 (2026-11-26) */
async function fresh() {
  vi.resetModules();
  return import('./phraseAudioCache');
}

function setup(sizes: Record<string, number>, served: Record<string, number> = sizes) {
  const store = new Map<string, Response>();
  vi.stubGlobal('caches', {
    open: async () => ({
      keys: async () => [...store.keys()].map((k) => new Request(`http://x${k}`)),
      match: async (k: string) => store.get(k),
      put: async (k: string, r: Response) => void store.set(k, r),
    }),
    delete: async () => {
      store.clear();
      return true;
    },
  });
  vi.stubGlobal('fetch', async (u: string) => {
    if (u.endsWith('manifest.json'))
      return Response.json({
        langs: {
          ja: Object.entries(sizes).filter(([f]) => f.startsWith('ja')),
          fr: Object.entries(sizes).filter(([f]) => f.startsWith('fr')),
        },
      });
    const f = u.slice('/phrases/'.length);
    return new Response(new Uint8Array(served[f] ?? 0));
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

it('언어만 받고, 크기가 다른(끊긴) 파일은 저장하지 않는다 — 다음 [받기] 때 다시', async () => {
  const store = setup(
    { 'ja-1.mp3': 3, 'ja-2.mp3': 4, 'fr-1.mp3': 5 },
    { 'ja-1.mp3': 3, 'ja-2.mp3': 2 },
  );
  const m = await fresh();
  const progress: number[] = [];
  const st = await m.downloadPhraseAudio(['ja'], (p) => progress.push(p.done));
  expect(st).toEqual({ have: 1, total: 2, bytes: 7, haveBytes: 3 });
  expect([...store.keys()]).toEqual(['/phrases/ja-1.mp3']);
  expect(store.get('/phrases/ja-1.mp3')?.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(progress.at(-1)).toBe(2);
  expect(m.isPhraseAudioSaved('/phrases/ja-1.mp3')).toBe(true);
  expect(m.isPhraseAudioSaved('/phrases/ja-2.mp3')).toBe(false);
});

it('전체 받은 양과 지우기 (설정)', async () => {
  setup({ 'ja-1.mp3': 3, 'fr-1.mp3': 5 });
  const m = await fresh();
  expect(await m.phraseAudioStatus()).toEqual({ have: 0, total: 2, bytes: 8, haveBytes: 0 });
  await m.downloadPhraseAudio();
  expect(await m.phraseAudioStatus()).toMatchObject({ have: 2, haveBytes: 8 });
  await m.clearPhraseAudio();
  expect(await m.phraseAudioStatus()).toMatchObject({ have: 0 });
  expect(m.isPhraseAudioSaved('/phrases/ja-1.mp3')).toBe(false);
});

it('잠깐 끊긴 파일은 한 번 더 받아 저장하고, 받을 때마다 알린다', async () => {
  const store = setup({ 'ja-1.mp3': 3 });
  const real = globalThis.fetch;
  let first = true;
  vi.stubGlobal('fetch', async (u: string, init?: RequestInit) => {
    if (u.endsWith('.mp3') && first) {
      first = false;
      throw new TypeError('network');
    }
    return real(u, init);
  });
  const m = await fresh();
  let told = 0;
  const off = m.onPhraseAudioChange(() => told++);
  const st = await m.downloadPhraseAudio(['ja']);
  off();
  expect(st.have).toBe(1);
  expect(store.has('/phrases/ja-1.mp3')).toBe(true);
  expect(told).toBeGreaterThan(0);
});
