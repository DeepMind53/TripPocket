/**
 * 네이버 검색 API — 블로그 (docs/14 §2, 무료·하루 25,000회). 최신순으로 받아 작성일(postdate)로 기간을 거른다.
 * 저장하는 것: 제목·요약·링크·작성일만, 캐시 6시간 (본문 복제 안 함, docs/14 §8)
 */
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
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=100&start=${start}&sort=date`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': keys.id, 'X-Naver-Client-Secret': keys.secret },
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
