import * as z from 'zod/mini';

/**
 * 환경 변수 → 설정. 빠지거나 틀리면 서버가 시작하지 않는다 (docs/09 §7.3).
 * 비밀값은 apps/server/.env (git 제외)에만 — .env.example 참고.
 */
const Env = z.object({
  NODE_ENV: z._default(z.enum(['development', 'production', 'test']), 'development'),
  /** 127.0.0.1에만 열어 둔다 — 밖에서는 터널(Tailscale Funnel)로만 들어온다 (docs/09 §7.1) */
  HOST: z._default(z.string(), '127.0.0.1'),
  PORT: z._default(z.coerce.number().check(z.int(), z.minimum(1), z.maximum(65535)), 8787),
  /** SQLite 파일 위치 (웹 루트 밖, 백업 대상) */
  DATA_DIR: z._default(z.string(), './data'),
  /** 웹앱 주소 — 상태를 바꾸는 요청의 Origin 검사 (예: https://trippocket.pages.dev) */
  WEB_ORIGIN: z.url(),
  /**
   * Cloudflare Pages 프록시가 붙여 보내는 비밀 헤더 값 (32자 이상).
   * 터널 주소로 직접 들어온 요청은 이 값이 없어 거부된다 (ADR-0006)
   */
  PROXY_SECRET: z.string().check(z.minLength(32)),
  /** 소셜 로그인 (docs/08 G2: 셋 다). 아이디·시크릿이 모두 있는 제공자만 켜진다 */
  KAKAO_CLIENT_ID: z.optional(z.string()),
  KAKAO_CLIENT_SECRET: z.optional(z.string()),
  NAVER_CLIENT_ID: z.optional(z.string()),
  NAVER_CLIENT_SECRET: z.optional(z.string()),
  GOOGLE_CLIENT_ID: z.optional(z.string()),
  GOOGLE_CLIENT_SECRET: z.optional(z.string()),
  /**
   * 네이버 검색 API (블로그·지역) = NAVER API HUB(네이버 클라우드) 앱의 Client ID·Secret.
   * 2026-07-31부터 개발자센터에는 검색 API를 새로 추가할 수 없다. 비우면 예전 방식(로그인 앱 키로 openapi.naver.com)
   */
  NAVER_SEARCH_ID: z.optional(z.string()),
  NAVER_SEARCH_SECRET: z.optional(z.string()),
  /** Google Places API (New) 서버 키 — 브라우저에 절대 넣지 않음, API 제한 = Places API (New) */
  GOOGLE_PLACES_KEY: z.optional(z.string()),
  /** 서버 전체 하루 Google 호출 상한 (월 무료: 검색 5천·상세 1천 → 하루 150·30이면 안전) */
  GOOGLE_SEARCH_DAILY: z._default(z.coerce.number().check(z.int(), z.minimum(0)), 150),
  GOOGLE_DETAILS_DAILY: z._default(z.coerce.number().check(z.int(), z.minimum(0)), 30),
  /** AI 추천 (21단계, 결정 L9): Groq API 키 — 서버에만 */
  GROQ_API_KEY: z.optional(z.string()),
  GROQ_MODEL: z._default(z.string(), 'openai/gpt-oss-120b'),
  /** 한국수출입은행 환율 API 인증키 (무료, 없으면 환율은 웹앱의 무료 보조 출처만) */
  EXIM_API_KEY: z.optional(z.string()),
  /** 가입 정책 (docs/08 G1): invite = 첫 계정 + 허용 목록만, open = 누구나 */
  SIGNUP: z._default(z.enum(['invite', 'open']), 'invite'),
  /** 허용 목록: "kakao:123,naver:abc" — 가입 거절 화면에 표시되는 값을 넣는다 */
  ALLOWED_ACCOUNTS: z.optional(z.string()),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    // 어떤 값이 문제인지만 알려 주고, 값 자체(비밀일 수 있음)는 찍지 않는다
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`서버 설정이 잘못됐어요: ${keys} (.env 확인, .env.example 참고)`);
  }
  return parsed.data;
}
