import * as z from 'zod/mini';

/**
 * 환경 변수 → 설정. 빠지거나 틀리면 서버가 시작하지 않는다 (docs/09 §7.3).
 * 비밀값은 apps/server/.env (git 제외)에만 — .env.example 참고.
 */
const Env = z.object({
  NODE_ENV: z._default(z.enum(['development', 'production', 'test']), 'development'),
  /** 로그 단계 — 기본 warn (요청마다 남기지 않아 CPU·디스크 절약, 2026-10-25). 문제 볼 때 info */
  LOG_LEVEL: z._default(z.enum(['error', 'warn', 'info', 'debug']), 'warn'),
  /** 127.0.0.1에만 열어 둔다 — 밖에서는 터널(Tailscale Funnel)로만 들어온다 (docs/09 §7.1) */
  HOST: z._default(z.string(), '127.0.0.1'),
  PORT: z._default(z.coerce.number().check(z.int(), z.minimum(1), z.maximum(65535)), 8787),
  /** SQLite 파일 위치 (웹 루트 밖, 백업 대상) */
  DATA_DIR: z._default(z.string(), './data'),
  /**
   * 웹앱 주소 — 상태를 바꾸는 요청의 Origin 검사, 로그인 콜백 주소.
   * 쉼표로 여러 개 (주소를 옮기는 동안): 첫 번째가 기본. 예: https://trippocket.day,https://trippocket.pages.dev
   */
  WEB_ORIGIN: z.string().check(
    z.refine((v) =>
      v.split(',').every((s) => {
        try {
          return new URL(s.trim()).origin === s.trim();
        } catch {
          return false;
        }
      }),
    ),
  ),
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
  /** Geoapify 서버 키 (무료 플랜) — Google 무료량이 끝났을 때 해외 검색·택시 카드 백업 (docs/23). 없으면 건너뜀 */
  GEOAPIFY_KEY: z.optional(z.string()),
  /**
   * AI 추천 (21단계, 결정 L9) — 무료 AI를 이 순서로 시도: Gemini → Workers AI → Groq.
   * 모두 없거나 한도에 걸리면 AI 없이 언급 수로 집계한다. 키는 서버에만
   */
  GEMINI_API_KEY: z.optional(z.string()),
  GEMINI_MODEL: z._default(z.string(), 'gemini-flash-lite-latest'),
  CF_ACCOUNT_ID: z.optional(z.string()),
  CF_AI_TOKEN: z.optional(z.string()),
  CF_AI_MODEL: z._default(z.string(), '@cf/openai/gpt-oss-120b'),
  GROQ_API_KEY: z.optional(z.string()),
  GROQ_MODEL: z._default(z.string(), 'openai/gpt-oss-120b'),
  /** 한국수출입은행 환율 API 인증키 (무료, 없으면 환율은 웹앱의 무료 보조 출처만) */
  EXIM_API_KEY: z.optional(z.string()),
  /** AviationStack 무료 키 (편명으로 항공편 불러오기, 월 100회) — 없으면 그 기능만 꺼짐 */
  AVIATIONSTACK_KEY: z.optional(z.string()),
  /** 웹 푸시 알림 (docs/20 G1) — 없으면 알림 기능이 꺼진다 */
  VAPID_PUBLIC_KEY: z.optional(z.string()),
  VAPID_PRIVATE_KEY: z.optional(z.string()),
  VAPID_SUBJECT: z.optional(z.string()),
  /** 가입 정책 (docs/08 G1): invite = 첫 계정 + 허용 목록만, open = 누구나 */
  SIGNUP: z._default(z.enum(['invite', 'open']), 'invite'),
  /** 허용 목록: "kakao:123,naver:abc" — 가입 거절 화면에 표시되는 값을 넣는다 */
  ALLOWED_ACCOUNTS: z.optional(z.string()),
  /** 관리자 고정 목록 "kakao:123,naver:abc" — 이 계정들만 관리자 (auth/admins.ts) */
  ADMIN_ACCOUNTS: z.optional(z.string()),
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

/** 허용하는 웹앱 주소들 (첫 번째 = 기본) */
export const webOrigins = (config: Config): string[] =>
  config.WEB_ORIGIN.split(',').map((s) => s.trim());

/**
 * 이 요청이 들어온 웹앱 주소 — Pages 프록시가 x-tp-origin 으로 알려 준다(브라우저가 보낸 값은 프록시가 지움).
 * 허용 목록에 없으면 기본 주소
 */
export function requestOrigin(
  config: Config,
  headers: Record<string, string | string[] | undefined>,
): string {
  const all = webOrigins(config);
  const got = headers['x-tp-origin'];
  return typeof got === 'string' && all.includes(got) ? got : all[0]!;
}
