import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { webOrigins, type Config } from './config';
import type { Db } from './db/database';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { usageRoutes } from './routes/usage';
import { ApiPaused, initApiUsage } from './services/apiUsage';
import { aiRoutes } from './routes/ai';
import { meRoutes } from './routes/me';
import { placesRoutes } from './routes/places';
import { shareRoutes } from './routes/share';
import { syncRoutes } from './routes/sync';
import { latestFx } from './services/fx';

export const PROXY_HEADER = 'x-tp-proxy';

/**
 * Fastify 앱 조립 (테스트에서는 inject로 바로 부른다).
 * 보안 기본값: docs/09 §7.2 — 본문 1MB, 보안 헤더, 요청 제한, 프록시 비밀 헤더, Origin 검사, 에러 내용 숨김
 */
export async function buildApp(config: Config, db: Db): Promise<FastifyInstance> {
  initApiUsage(db);
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    // Cloudflare 프록시 뒤 — 실제 접속 IP는 프록시가 알려 준다
    trustProxy: true,
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            // 토큰·쿠키·이메일이 로그에 남지 않게 (docs/09 §7.2)
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              `req.headers["${PROXY_HEADER}"]`,
            ],
          },
  });

  await app.register(helmet, {
    // API는 HTML을 주지 않는다 → 아무것도 허용하지 않는 CSP
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  // 터널 주소로 직접 들어온 요청 거부: Cloudflare Pages 프록시만 비밀 헤더를 안다 (ADR-0006)
  const secret = Buffer.from(config.PROXY_SECRET);
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/healthz') return;
    const got = Buffer.from(String(req.headers[PROXY_HEADER] ?? ''));
    if (got.length !== secret.length || !timingSafeEqual(got, secret)) {
      return reply.code(404).send({ error: 'not_found' });
    }
  });

  // CSRF: 상태를 바꾸는 요청은 웹앱 주소에서 온 것만 (docs/09 §7.2)
  app.addHook('onRequest', async (req, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    if (!webOrigins(config).includes(req.headers.origin ?? '')) {
      return reply.code(403).send({ error: 'bad_origin' });
    }
  });

  app.setErrorHandler((error, req, reply) => {
    // 관리자가 멈췄거나 이번 달 자동 상한에 닿은 외부 API (API 사용량 화면)
    if (error instanceof ApiPaused) return reply.code(503).send({ error: 'api_paused' });
    const err = error as { statusCode?: number; code?: string };
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) req.log.error(error);
    // 스택·SQL 같은 내부 정보는 응답에 넣지 않는다
    return reply
      .code(status)
      .send({ error: status >= 500 ? 'server_error' : (err.code ?? 'bad_request') });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  authRoutes(app, config, db);
  meRoutes(app, db);
  adminRoutes(app, db);
  usageRoutes(app);
  syncRoutes(app, db);
  aiRoutes(app, config, db);
  shareRoutes(app, db);
  placesRoutes(app, config, db);

  // 환율: 로그인 불필요(공개 데이터), IP당 제한, 1시간 캐시 (docs/12 §2.2)
  app.get(
    '/api/fx/latest',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_req, reply) => {
      const fx = latestFx(db);
      if (!fx) return reply.code(404).send({ error: 'no_rates' });
      reply.header('cache-control', 'public, max-age=3600');
      return fx;
    },
  );

  // 상태 확인 (외부 모니터용, 프록시 없이도 응답) — 내부 정보는 내보내지 않는다
  app.get('/healthz', async () => {
    db.prepare('SELECT 1').get();
    return { ok: true };
  });

  return app;
}
