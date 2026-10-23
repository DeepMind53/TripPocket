import { loadConfig } from '../src/config';
import { naverSearchKeys, naverSearchRequest } from '../src/services/naverBlog';

const base = { NODE_ENV: 'test', WEB_ORIGIN: 'https://a.dev', PROXY_SECRET: 's'.repeat(40) };
const q = new URLSearchParams({ query: '성수 카페', display: '5' });

describe('네이버 검색 키', () => {
  it('HUB 키가 있으면 NAVER API HUB 주소·헤더 (개발자센터 신규 등록 종료)', () => {
    const keys = naverSearchKeys(
      loadConfig({
        ...base,
        NAVER_CLIENT_ID: 'login',
        NAVER_CLIENT_SECRET: 'ls',
        NAVER_SEARCH_ID: 'hub',
        NAVER_SEARCH_SECRET: 'hs',
      }),
    )!;
    const [url, headers] = naverSearchRequest(keys, 'local', q);
    expect(url).toBe(`https://naverapihub.apigw.ntruss.com/search/v1/local?${q}`);
    expect(headers).toEqual({ 'X-NCP-APIGW-API-KEY-ID': 'hub', 'X-NCP-APIGW-API-KEY': 'hs' });
  });

  it('없으면 로그인 앱 키로 예전 주소, 둘 다 없으면 꺼짐', () => {
    const keys = naverSearchKeys(
      loadConfig({ ...base, NAVER_CLIENT_ID: 'login', NAVER_CLIENT_SECRET: 'ls' }),
    )!;
    const [url, headers] = naverSearchRequest(keys, 'blog', q);
    expect(url).toBe(`https://openapi.naver.com/v1/search/blog.json?${q}`);
    expect(headers['X-Naver-Client-Id']).toBe('login');
    expect(naverSearchKeys(loadConfig(base))).toBeNull();
  });
});
