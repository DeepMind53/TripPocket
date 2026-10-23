/**
 * 네이버 검색 API — 블로그 (docs/14 §2, 무료·하루 25,000회). 최신순으로 받아 작성일(postdate)로 기간을 거른다.
 * 저장하는 것: 제목·요약·링크·작성일만, 캐시 6시간 (본문 복제 안 함, docs/14 §8)
 */
import type { Config } from '../config';
import { guardApi, trackApi } from './apiUsage';

export interface BlogPost {
  title: string;
  description: string;
  link: string;
  postdate: string;
  blogger: string;
}

export interface NaverKeys {
  id: string;
  secret: string;
  /** true = NAVER API HUB (naverapihub.apigw.ntruss.com), false = 예전 개발자센터 (openapi.naver.com) */
  hub: boolean;
}

/** 설정 → 검색 키. HUB 키가 있으면 HUB, 없으면 로그인 앱 키로 예전 주소 */
export function naverSearchKeys(config: Config): NaverKeys | null {
  if (config.NAVER_SEARCH_ID && config.NAVER_SEARCH_SECRET)
    return { id: config.NAVER_SEARCH_ID, secret: config.NAVER_SEARCH_SECRET, hub: true };
  if (config.NAVER_CLIENT_ID && config.NAVER_CLIENT_SECRET)
    return { id: config.NAVER_CLIENT_ID, secret: config.NAVER_CLIENT_SECRET, hub: false };
  return null;
}

/** 검색 요청 주소·헤더 (응답 형식은 둘이 같다: total·items) */
export function naverSearchRequest(
  keys: NaverKeys,
  kind: 'blog' | 'local',
  params: URLSearchParams,
): [string, Record<string, string>] {
  return keys.hub
    ? [
        `https://naverapihub.apigw.ntruss.com/search/v1/${kind}?${params}`,
        { 'X-NCP-APIGW-API-KEY-ID': keys.id, 'X-NCP-APIGW-API-KEY': keys.secret },
      ]
    : [
        `https://openapi.naver.com/v1/search/${kind}.json?${params}`,
        { 'X-Naver-Client-Id': keys.id, 'X-Naver-Client-Secret': keys.secret },
      ];
}

const strip = (s: unknown) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();

/** 최신순으로 최대 max개 (100개씩, sinceYmd보다 오래된 글이 나오면 멈춤) */
export async function searchBlog(
  query: string,
  keys: NaverKeys,
  opts: { max?: number; sinceYmd?: string } = {},
): Promise<BlogPost[]> {
  const max = Math.min(opts.max ?? 300, 1000);
  const out: BlogPost[] = [];
  for (let start = 1; start <= max && start <= 1000; start += 100) {
    const [url, headers] = naverSearchRequest(
      keys,
      'blog',
      new URLSearchParams({ query, display: '100', start: String(start), sort: 'date' }),
    );
    guardApi('naver_search');
    trackApi('naver_search');
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`naver ${res.status}`);
    const body = (await res.json()) as { items?: Record<string, unknown>[] };
    const items = body.items ?? [];
    for (const it of items) {
      const post: BlogPost = {
        title: strip(it.title),
        description: strip(it.description),
        link: String(it.link ?? ''),
        postdate: String(it.postdate ?? ''),
        blogger: strip(it.bloggername),
      };
      if (opts.sinceYmd && post.postdate < opts.sinceYmd) return out;
      // 원문 링크는 https만 (화면에서 바로 여는 주소)
      if (post.link.startsWith('https://')) out.push(post);
    }
    if (items.length < 100) break;
  }
  return out.slice(0, max);
}
