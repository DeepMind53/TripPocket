import type { AiCategory, ExtractedPlace, PlaceSummary, SourcePost } from '@trippocket/shared';
import { searchKakao, searchNaver } from './places';
import type { NaverKeys } from './naverBlog';

/**
 * AI 없는 추천 (무료 AI가 모두 한도에 걸렸을 때): 지도 검색(카카오·네이버)으로 기준점 근처 후보를 받고,
 * 수집한 블로그 글에서 그 이름이 나온 글을 근거로 센다. 근거 글이 없는 후보는 버린다 (docs/14 §8).
 * 요약·광고 의심 표시는 없다
 */
const WORD: Record<AiCategory, string> = { food: '맛집', cafe: '카페', play: '가볼만한곳' };

/** 비교용: 공백·기호를 빼고 소문자 */
const norm = (s: string) => s.toLowerCase().replace(/[\s·.,'"()[\]<>&/-]/g, '');

/** "어니언 성수점" → ["어니언성수점", "어니언"] (지점 이름 없이도 맞게, 너무 짧은 이름은 빼서 오탐 방지) */
function namesOf(name: string): string[] {
  const full = norm(name);
  const first = norm(name.split(/\s+/)[0] ?? '');
  return [...new Set([full, first])].filter((n) => n.length >= 2 && (n === full || n.length >= 3));
}

export async function basicExtract(
  anchor: string,
  category: AiCategory,
  posts: readonly (SourcePost & { description?: string })[],
  keys: { kakao?: string | undefined; naver: NaverKeys | null },
): Promise<ExtractedPlace[]> {
  const q = `${anchor} ${WORD[category]}`;
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
