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
