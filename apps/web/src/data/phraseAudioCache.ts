import { PHRASE_IDS, phraseLangFor } from '@trippocket/shared';
import { phraseAudioUrl } from '../domain/phraseAudio';

/** 회화 음성 저장 칸 — 앱을 업데이트해도 지우지 않는다 (sw-template.js activate가 남겨 둠) */
export const PHRASE_CACHE = 'tp-phrases';

const done = new Set<string>();

/**
 * 여행지 말의 회화 음성 20개를 미리 받아 둔다 (2026-11-26): 전체 400개(약 5MB)를 설치 때 받지 않고,
 * 여행을 열 때 그 나라 말만(약 250KB) 한가할 때 받는다 → 현지에서 비행기 모드여도 들린다.
 * 이미 받은 파일은 건너뛴다. 인터넷이 없거나 실패하면 조용히 넘어간다 (누를 때 다시 받음)
 */
export async function prefetchPhraseAudio(countryCodes: readonly (string | undefined)[]) {
  if (typeof caches === 'undefined' || !navigator.onLine) return;
  const langs = [
    ...new Set(countryCodes.map((c) => phraseLangFor(c)).filter((l) => l !== undefined)),
  ];
  for (const lang of langs) {
    if (done.has(lang.code)) continue;
    done.add(lang.code);
    try {
      const cache = await caches.open(PHRASE_CACHE);
      for (const id of PHRASE_IDS) {
        const url = phraseAudioUrl(lang.code, lang.phrases[id]);
        if (!(await cache.match(url))) await cache.add(url);
      }
    } catch {
      done.delete(lang.code);
    }
  }
}

/** 기기 저장소에서 꺼내 바로 틀 수 있게 만든 소리 (주소 → blob: 주소). 누른 그 순간 바로 틀려고 메모리에 둔다 */
const ready = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

/** 이미 꺼내 둔 소리면 그 주소 (없으면 undefined) — 누른 동작 안에서 바로 틀 때 */
export const readyPhraseAudio = (url: string): string | undefined => ready.get(url);

/**
 * 회화 소리 준비 (2026-11-26 사용자 요청 "음원이 없을 때 누르면 한 번 받아 기기에 저장해 두고 재생"):
 * 기기 저장소(tp-phrases)에 있으면 꺼내고, 없으면 통째로 한 번 받아 저장한 뒤 꺼낸다.
 * <audio>에 주소 대신 기기 안 데이터를 넘겨 서비스 워커·조각 요청(Range)을 거치지 않는다
 */
export function loadPhraseAudio(url: string): Promise<string> {
  const hit = ready.get(url);
  if (hit) return Promise.resolve(hit);
  const running = loading.get(url);
  if (running) return running;
  const job = (async () => {
    let res: Response | undefined;
    const cache = typeof caches === 'undefined' ? undefined : await caches.open(PHRASE_CACHE);
    res = await cache?.match(url);
    if (!res) {
      const got = await fetch(url);
      if (!got.ok) throw new Error(`소리 파일 없음 ${got.status}`);
      await cache?.put(url, got.clone()).catch(() => undefined);
      res = got;
    }
    const blob = await res.blob();
    const local = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }));
    ready.set(url, local);
    return local;
  })().finally(() => loading.delete(url));
  loading.set(url, job);
  return job;
}

/** 이 말의 회화 소리를 미리 꺼내 둔다 (회화 화면을 열 때) — 실패는 조용히 */
export function warmPhraseAudio(urls: readonly string[]): void {
  for (const u of urls) void loadPhraseAudio(u).catch(() => undefined);
}
