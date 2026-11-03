import { guardApi, trackApi } from './apiUsage';

/**
 * 여행지 한 줄 소개 (docs/26 A4, 실험실 "여행지 소개" 2026-11-03): 위키백과(한국어) REST 요약.
 * 보내는 것은 도시 이름뿐. 같은 이름은 30일 동안 서버 메모리에 두고 다시 묻지 않는다.
 * 본문은 CC BY-SA 4.0 — 앱이 "위키백과" 출처와 원문 링크를 함께 보여 준다
 */
export interface WikiSummary {
  title: string;
  /** 앞 두 문장 (최대 200자) */
  extract: string;
  url: string;
}

const TTL = 30 * 86_400_000;
const MAX = 500;
const cache = new Map<string, { at: number; value: WikiSummary | null }>();
const UA = 'TripPocket/1.0 (https://trippocket.day)';

/** 앞 두 문장만 (괄호 속 한자·로마자는 빼서 짧게) */
export function shortExtract(text: string): string {
  const plain = text
    .replace(/\s*\([^()]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = plain.match(/[^.!?。]+[.!?。]?/g) ?? [plain];
  const two = sentences.slice(0, 2).join('').trim();
  return two.length > 200 ? `${two.slice(0, 199)}…` : two;
}

export async function wikiSummary(title: string): Promise<WikiSummary | null> {
  const key = title.trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  guardApi('wikipedia');
  trackApi('wikipedia');
  const res = await fetch(
    `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
    {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    },
  );
  let value: WikiSummary | null = null;
  if (res.ok) {
    const body = (await res.json()) as {
      type?: unknown;
      title?: unknown;
      extract?: unknown;
      content_urls?: { mobile?: { page?: unknown } };
    };
    const url = body.content_urls?.mobile?.page;
    // 동음이의어 문서·빈 요약은 쓰지 않는다
    if (
      body.type === 'standard' &&
      typeof body.title === 'string' &&
      typeof body.extract === 'string' &&
      body.extract.trim() &&
      typeof url === 'string' &&
      url.startsWith('https://ko.m.wikipedia.org/')
    )
      value = { title: body.title, extract: shortExtract(body.extract), url };
  } else if (res.status !== 404) {
    throw new Error(`wikipedia ${res.status}`);
  }
  if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** 시험용 */
export const resetWikiCache = () => cache.clear();
