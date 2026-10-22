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
