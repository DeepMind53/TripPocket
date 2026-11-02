import type { FastifyInstance } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { llmProviders, translateTerms } from '../services/llm';

/** 건강 카드 언어 (shared health.ts·phrases.ts와 같은 코드) */
const LANGS = ['ja', 'zh-CN', 'zh-TW', 'zh-HK', 'th', 'vi', 'id', 'en', 'fr', 'it', 'es', 'mn'];
/** 한 사람이 하루에 번역할 수 있는 횟수 (무료 AI 한도를 나눠 쓰므로) */
export const TRANSLATE_PER_DAY = 20;

const Body = z.object({
  terms: z
    .array(
      z.object({
        id: z.string().check(z.regex(/^[a-z0-9]{1,8}$/)),
        ko: z.string().check(z.maxLength(40)),
        en: z.string().check(z.maxLength(40)),
      }),
    )
    .check(z.minLength(1), z.maxLength(21)),
});

/**
 * 직접 입력한 음식·복용약 이름 번역 (사용자 결정 2026-11-02) — 로그인 필요, 사람당 하루 20회.
 * 이름만 무료 AI로 보내고 저장하지 않는다. 실패하면 503 → 앱이 번역기 바로가기로 안내
 */
export function translateRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const providers = llmProviders(config);
  let day = '';
  const used = new Map<string, number>();
  app.post(
    '/api/translate/terms',
    { preHandler: requireUser(db), config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      const today = new Date().toISOString().slice(0, 10);
      if (day !== today) {
        day = today;
        used.clear();
      }
      const uid = req.user!.userId;
      if ((used.get(uid) ?? 0) >= TRANSLATE_PER_DAY)
        return reply
          .code(429)
          .send({ error: 'daily_limit', feature: 'translate', limit: TRANSLATE_PER_DAY });
      const terms = parsed.data.terms
        .map((t) => ({ ...t, ko: t.ko.trim(), en: t.en.trim() }))
        .filter((t) => t.ko || t.en);
      if (terms.length === 0) return reply.code(400).send({ error: 'bad_request' });
      const result = await translateTerms(providers, terms, LANGS, (engine, err) =>
        req.log.warn({ engine, err: String(err) }, 'translate failed'),
      );
      if (!result) return reply.code(503).send({ error: 'unavailable' });
      used.set(uid, (used.get(uid) ?? 0) + 1);
      return { translations: result };
    },
  );
}
