import { loadConfig } from '../src/config';
import { openDb } from '../src/db/database';
import { initApiUsage } from '../src/services/apiUsage';
import { widenSources } from '../src/services/basicRecommend';
import { extractPlaces, llmProviders, resetLlmCooldown } from '../src/services/llm';

/** AI 결과 보강 (2026-11-02 분석): 언급 수 다시 세기, 잘린 출력이면 글을 줄여 다시 */
const post = (id: string, title: string) => ({
  id,
  title,
  link: `https://b/${id}`,
  postdate: '20261101',
});

describe('widenSources', () => {
  it('가게 전체 이름이 나온 글을 근거에 더하고, 첫 단어만 같은 글은 더하지 않는다', () => {
    const posts = [
      post('p0', '신주쿠 규카츠 모토무라 후기'),
      post('p1', '규카츠모토무라 웨이팅 팁'),
      post('p2', '규카츠 맛집 3곳 비교'),
      post('p3', 'Motomura Shinjuku review'),
    ];
    const [x] = widenSources(
      [
        {
          name: '규카츠 모토무라',
          localName: 'Motomura Shinjuku',
          category: 'food',
          sourceIds: ['p0'],
          adSuspect: false,
          summary: '',
        },
      ],
      posts,
    );
    expect(x!.sourceIds.sort()).toEqual(['p0', 'p1', 'p3']);
  });
});

describe('extractPlaces', () => {
  beforeEach(() => {
    resetLlmCooldown();
    initApiUsage(openDb(':memory:'));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Gemini는 JSON으로만 답하게 하고, 깨진 JSON이면 글을 절반으로 줄여 한 번 더', async () => {
    const providers = llmProviders(
      loadConfig({
        NODE_ENV: 'test',
        WEB_ORIGIN: 'https://a.dev',
        PROXY_SECRET: 's'.repeat(40),
        GEMINI_API_KEY: 'g',
      }),
    );
    const sent: { response_format?: unknown; posts: number }[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        response_format?: unknown;
        messages: { content: string }[];
      };
      sent.push({
        response_format: body.response_format,
        posts: (JSON.parse(body.messages[1]!.content) as { posts: unknown[] }).posts.length,
      });
      const content =
        sent.length === 1
          ? '{"places":[{"name":"잘린' // 출력이 중간에 잘림
          : JSON.stringify({ places: [{ name: '이치란', category: 'food', sourceIds: ['p0'] }] });
      return Response.json({ choices: [{ message: { content } }] });
    });
    const posts = Array.from({ length: 80 }, (_, i) => post(`p${i}`, `글 ${i}`));
    const r = await extractPlaces(providers, '신주쿠역', 'food', posts);
    expect(r?.places.map((x) => x.name)).toEqual(['이치란']);
    expect(sent[0]).toMatchObject({ response_format: { type: 'json_object' }, posts: 80 });
    expect(sent[1]!.posts).toBe(40);
  });
});
