import type { Config } from '../config';

/**
 * 소셜 로그인 제공자 (docs/09 §4.1). 시크릿은 서버에만 — 코드 교환도 서버에서.
 * PKCE: 구글만 지원(카카오·네이버 공식 문서에 없음) → 모두 state + 브라우저 쿠키 대조, 구글은 PKCE 추가
 */
export type ProviderId = 'kakao' | 'naver' | 'google';
export const PROVIDERS: readonly ProviderId[] = ['kakao', 'naver', 'google'];

export interface Profile {
  providerUserId: string;
  nickname: string;
}

interface ProviderSpec {
  authorizeUrl: string;
  tokenUrl: string;
  scope?: string;
  pkce: boolean;
  profile: (accessToken: string) => Promise<Profile>;
}

async function getJson(url: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const obj = (v: unknown) =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

export const SPECS: Record<ProviderId, ProviderSpec> = {
  kakao: {
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    scope: 'profile_nickname',
    pkce: false,
    profile: async (token) => {
      const me = await getJson('https://kapi.kakao.com/v2/user/me', token);
      const nickname = str(obj(obj(me.kakao_account).profile).nickname);
      return { providerUserId: str(me.id), nickname };
    },
  },
  naver: {
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    pkce: false,
    profile: async (token) => {
      const me = obj((await getJson('https://openapi.naver.com/v1/nid/me', token)).response);
      return { providerUserId: str(me.id), nickname: str(me.nickname) };
    },
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid profile',
    pkce: true,
    profile: async (token) => {
      const me = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token);
      return { providerUserId: str(me.sub), nickname: str(me.name) };
    },
  },
};

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

/** 설정에 아이디·시크릿이 모두 있는 제공자만 켠다 */
export function credentialsFor(config: Config, p: ProviderId): Credentials | null {
  const id = config[`${p.toUpperCase()}_CLIENT_ID` as 'KAKAO_CLIENT_ID'];
  const secret = config[`${p.toUpperCase()}_CLIENT_SECRET` as 'KAKAO_CLIENT_SECRET'];
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}

/** 콜백 주소 = 로그인을 시작한 웹앱 주소 기준 (쿠키가 그 주소에 있으므로) */
export function redirectUri(origin: string, p: ProviderId): string {
  return `${origin}/auth/${p}/callback`;
}

/** 인가 코드 → 액세스 토큰 (서버에서만, 시크릿 사용) */
export async function exchangeCode(
  spec: ProviderSpec,
  creds: Credentials,
  args: { code: string; redirectUri: string; state: string; codeVerifier: string | null },
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code: args.code,
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  if (args.codeVerifier) body.set('code_verifier', args.codeVerifier);
  const res = await fetch(spec.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });
  const json = obj(await res.json().catch(() => ({})));
  if (!res.ok || typeof json.access_token !== 'string') throw new Error(`token ${res.status}`);
  return json.access_token;
}
