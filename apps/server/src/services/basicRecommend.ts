import type { AiCategory, ExtractedPlace, PlaceSummary, SourcePost } from '@trippocket/shared';
import { searchKakao, searchNaver } from './places';
import type { NaverKeys } from './naverBlog';

/**
 * AI 없는 추천 (무료 AI가 모두 한도에 걸렸을 때): 지도 검색(카카오·네이버)으로 기준점 근처 후보를 받고,
 * 수집한 블로그 글에서 그 이름이 나온 글을 근거로 센다. 근거 글이 없는 후보는 버린다 (docs/14 §8).
 * 요약·광고 의심 표시는 없다
 */
/** 지도 검색어 (custom = 사용자 키워드를 그대로) */
export const WORD: Record<Exclude<AiCategory, 'custom'>, string> = {
  food: '맛집',
  cafe: '카페',
  play: '가볼만한곳',
};

/** 비교용: 공백·기호를 빼고 소문자 */
export const norm = (s: string) => s.toLowerCase().replace(/[\s·.,'"()[\]<>&/-]/g, '');

/** "어니언 성수점" → ["어니언성수점", "어니언"] (지점 이름 없이도 맞게, 너무 짧은 이름은 빼서 오탐 방지) */
export function namesOf(name: string): string[] {
  const full = norm(name);
  const first = norm(name.split(/\s+/)[0] ?? '');
  return [...new Set([full, first])].filter((n) => n.length >= 2 && (n === full || n.length >= 3));
}

/**
 * AI가 뽑은 장소의 근거 글 넓히기: AI는 같은 가게를 말한 글을 일부만 잇는 일이 많아(대부분 "글 1개"),
 * 가게 전체 이름(또는 현지어 이름)이 제목·요약에 그대로 나온 글을 서버가 다시 찾아 더한다.
 * 첫 단어만으로는 맞추지 않는다 ("규카츠 모토무라"의 "규카츠"가 모든 규카츠 글에 걸리지 않게)
 */
export function widenSources(
  places: readonly ExtractedPlace[],
  posts: readonly (SourcePost & { description?: string })[],
): ExtractedPlace[] {
  const texts = posts.map((p) => ({ id: p.id, text: norm(`${p.title} ${p.description ?? ''}`) }));
  return places.map((x) => {
    const names = [x.name, x.localName ?? ''].map(norm).filter((n) => n.length >= 3);
    if (names.length === 0) return x;
    const found = texts.filter((t) => names.some((n) => t.text.includes(n))).map((t) => t.id);
    return { ...x, sourceIds: [...new Set([...x.sourceIds, ...found])] };
  });
}

export async function basicExtract(
  anchor: string,
  category: AiCategory,
  posts: readonly (SourcePost & { description?: string })[],
  keys: { kakao?: string | undefined; naver: NaverKeys | null },
  keyword?: string,
): Promise<ExtractedPlace[]> {
  const q = `${anchor} ${category === 'custom' ? (keyword ?? '') : WORD[category]}`;
  const candidates: PlaceSummary[] = [];
  // 한쪽이 실패해도 다른 쪽 후보로 진행
  if (keys.kakao) candidates.push(...(await searchKakao(q, keys.kakao).catch(() => [])));
  if (keys.naver) candidates.push(...(await searchNaver(q, keys.naver).catch(() => [])));

  const texts = posts.map((p) => ({ id: p.id, text: norm(`${p.title} ${p.description ?? ''}`) }));
  const seen = new Set<string>();
  const out: ExtractedPlace[] = [];
  for (const c of candidates) {
    const key = norm(c.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const names = namesOf(c.name);
    const sourceIds = texts.filter((t) => names.some((n) => t.text.includes(n))).map((t) => t.id);
    if (sourceIds.length > 0)
      out.push({ name: c.name, category, sourceIds, adSuspect: false, summary: '' });
  }
  return out;
}
