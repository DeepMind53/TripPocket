import { phraseLangFor } from '@trippocket/shared';

/**
 * 회화 소리 데이터 — 중국어 학습 앱(Study_Taiwan_Chinese lib/tts-cache.web.ts)과 같은 방식 (2026-11-26 사용자 요청):
 * - 받기 목록 /phrases/manifest.json (언어 → [파일, 바이트], scripts/gen-phrase-audio.mjs가 만든다)
 * - [받기]를 누르면 여러 개씩 받아 크기를 맞춰 본 뒤 기기 저장소(Cache Storage 'tp-phrases')에 넣는다
 * - 재생은 같은 주소 /phrases/… 로 — 서비스 워커(sw-template.js)가 저장본에서 응답 (아이폰 Range 요청은 206 조각)
 * 저장소는 앱을 업데이트해도 지우지 않는다 (sw-template.js activate가 남겨 둠)
 */
export const PHRASE_CACHE = 'tp-phrases';
const BASE = '/phrases/';
const CONC = 6;
const FILE_TIMEOUT_MS = 15_000;

type Manifest = { langs: Record<string, [file: string, bytes: number][]> };
export interface AudioStatus {
  /** 받은 개수 / 전체 */
  have: number;
  total: number;
  /** 전체 바이트 · 받은 바이트 */
  bytes: number;
  haveBytes: number;
}

let manifest: Promise<Manifest> | null = null;
/** 기기에 받아 둔 파일 이름 (재생할 때 바로 묻는다) */
let saved: Set<string> | null = null;
const hasCaches = () => typeof caches !== 'undefined';

function loadManifest(): Promise<Manifest> {
  manifest ??= fetch(`${BASE}manifest.json`, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`받기 목록 ${r.status}`);
      return r.json() as Promise<Manifest>;
    })
    .catch((e: unknown) => {
      manifest = null;
      throw e;
    });
  return manifest;
}

/** 기기에 받아 둔 소리 목록을 읽는다 (처음 한 번) */
export async function initPhraseAudio(): Promise<Set<string>> {
  if (saved) return saved;
  const names = new Set<string>();
  if (hasCaches()) {
    try {
      for (const req of await (await caches.open(PHRASE_CACHE)).keys())
        names.add(new URL(req.url).pathname.slice(BASE.length));
    } catch {
      // 저장소를 못 읽으면 받은 것 없음으로
    }
  }
  saved = names;
  return names;
}

/** 이 소리 파일을 기기에 받아 두었나 (재생 전에 바로 묻는다 — 목록을 아직 안 읽었으면 false) */
export const isPhraseAudioSaved = (url: string) => !!saved?.has(url.slice(BASE.length));

/** 언어별(없으면 전체) 받은 개수·크기 */
export async function phraseAudioStatus(langs?: readonly string[]): Promise<AudioStatus> {
  const [m, have] = await Promise.all([loadManifest(), initPhraseAudio()]);
  const st: AudioStatus = { have: 0, total: 0, bytes: 0, haveBytes: 0 };
  for (const [code, files] of Object.entries(m.langs)) {
    if (langs && !langs.includes(code)) continue;
    for (const [file, bytes] of files) {
      st.total++;
      st.bytes += bytes;
      if (have.has(file)) {
        st.have++;
        st.haveBytes += bytes;
      }
    }
  }
  return st;
}

export type AudioProgress = { done: number; total: number };

/** 파일 하나 받기 — 휴대폰 망에서 멈춰 버린 요청이 "받는 중"을 끝없이 잡지 않게 15초에서 끊는다 */
async function fetchAudio(url: string): Promise<Blob> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), FILE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: stop.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}

const listeners = new Set<() => void>();
/** 받은 소리가 바뀌면 알려 준다 (회화 화면 [받기] 줄·설정이 다시 센다) — 끊는 함수를 돌려준다 */
export function onPhraseAudioChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((fn) => fn());
const running = new Map<string, Promise<AudioStatus>>();

/**
 * 소리 받기: 아직 없는 파일만 여러 개씩 받아 크기를 맞춰 보고 저장한다 (중국어 학습 앱 syncTtsCache와 같게).
 * 크기가 다르면(끊긴 다운로드) 저장하지 않고 다음에 다시. 같은 언어를 동시에 두 번 받지 않는다
 */
export function downloadPhraseAudio(
  langs?: readonly string[],
  onProgress?: (p: AudioProgress) => void,
): Promise<AudioStatus> {
  const key = langs ? [...langs].sort().join(',') : '*';
  const now = running.get(key);
  if (now) return now;
  const job = (async () => {
    if (!hasCaches()) throw new Error('이 브라우저는 소리 저장을 지원하지 않음');
    // 저장 공간이 모자랄 때 브라우저가 임의로 지우지 않게 (홈 화면 앱·크롬은 대개 허용)
    void navigator.storage?.persist?.().catch(() => false);
    const [m, have] = await Promise.all([loadManifest(), initPhraseAudio()]);
    const cache = await caches.open(PHRASE_CACHE);
    const todo = Object.entries(m.langs)
      .filter(([code]) => !langs || langs.includes(code))
      .flatMap(([, files]) => files)
      .filter(([file]) => !have.has(file));
    let done = 0;
    let cursor = 0;
    onProgress?.({ done, total: todo.length });
    const worker = async () => {
      while (cursor < todo.length) {
        const [file, bytes] = todo[cursor++]!;
        // 한 번 실패하면 한 번 더 (휴대폰 망에서 잠깐 끊길 때)
        for (let attempt = 0; attempt < 2 && !have.has(file); attempt++) {
          try {
            const blob = await fetchAudio(BASE + file);
            if (blob.size !== bytes) throw new Error('크기가 다름');
            await cache.put(
              BASE + file,
              new Response(blob, {
                headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) },
              }),
            );
            have.add(file);
          } catch {
            // 다음 시도, 그래도 안 되면 다음 [받기] 때
          }
        }
        onProgress?.({ done: ++done, total: todo.length });
        notify();
      }
    };
    await Promise.all(Array.from({ length: CONC }, worker));
    return phraseAudioStatus(langs);
  })().finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

/** 받아 둔 회화 소리를 모두 지운다 (설정) */
export async function clearPhraseAudio(): Promise<void> {
  if (hasCaches()) await caches.delete(PHRASE_CACHE).catch(() => false);
  saved = new Set();
  notify();
}

/**
 * 여행을 열 때 여행지 말 소리를 조용히 받아 둔다 (2026-11-26) — 현지에서 인터넷 없이도 들리게.
 * 인터넷이 없거나 실패하면 그냥 넘어간다 (회화 화면 [받기]·누를 때 다시)
 */
export function prefetchPhraseAudio(countryCodes: readonly (string | undefined)[]): void {
  if (!hasCaches() || !navigator.onLine) return;
  const langs = [
    ...new Set(
      countryCodes.map((c) => phraseLangFor(c)?.code).filter((c): c is string => c !== undefined),
    ),
  ];
  if (langs.length) void downloadPhraseAudio(langs).catch(() => undefined);
}
