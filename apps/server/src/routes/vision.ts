import {
  OCR_MAX_BYTES,
  TRANSLATE_TEXT_DAILY,
  TRANSLATE_TEXT_MAX_LINES,
  VISION_DAILY,
  type PhotoTranslation,
  type VisionFeature,
  type VisionNames,
} from '@trippocket/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { userDailyRepo } from '../repositories/userDailyRepo';
import { apiAllowed } from '../services/apiUsage';
import { llmProviders, translateLines } from '../services/llm';
import { azureOcr, googleOcr, googleVisionNames, type OcrRead } from '../services/ocr';

/** 번역할 줄 상한 (메뉴판 한 장이면 충분, 무료 AI 토큰 아끼기) */
const MAX_LINES = 60;

/**
 * 사진 기능 (실험실 — 2026-11-11, ADR-0012): 사진으로 번역 · 사진 속 장소 · 사진 분류.
 * JPEG 본문으로만 받아 바로 보내고, 사진·결과를 저장하거나 기록하지 않는다. 로그인 필요, 기능마다 한 사람 하루 한도
 */
export function visionRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const providers = llmProviders(config);
  const gkey = () => config.GOOGLE_VISION_KEY ?? config.GOOGLE_PLACES_KEY;
  const opts = {
    preHandler: requireUser(db),
    bodyLimit: OCR_MAX_BYTES,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  };

  /** 공통: JPEG 확인 + 그 기능의 오늘 한도. 통과하면 [사진, 쓴 수 올리기, 남은 수] */
  const gate = (feature: VisionFeature, req: FastifyRequest, reply: FastifyReply) => {
    reply.header('cache-control', 'no-store');
    if (req.headers['content-type'] !== 'image/jpeg' || !Buffer.isBuffer(req.body)) {
      void reply.code(400).send({ error: 'bad_request' });
      return null;
    }
    const usage = userDailyRepo(db, `vision_${feature}`);
    const userId = req.user!.userId;
    const n = usage.used(userId);
    const limit = VISION_DAILY[feature];
    if (n >= limit) {
      void reply.code(429).send({ error: 'vision_daily', feature, limit, left: 0 });
      return null;
    }
    return { image: req.body, done: () => usage.bump(userId), left: limit - n - 1 };
  };

  app.post('/api/vision/translate', opts, async (req, reply) => {
    const g = gate('translate', req, reply);
    if (!g) return reply;
    let read: OcrRead | null = null;
    const key = gkey();
    if (key && apiAllowed('google_vision'))
      read = await googleOcr(g.image, key).catch((e: unknown) => {
        req.log.warn(`google ocr 실패: ${String(e).slice(0, 120)}`);
        return null;
      });
    if (
      read === null &&
      config.AZURE_VISION_ENDPOINT &&
      config.AZURE_VISION_KEY &&
      apiAllowed('azure_read')
    )
      read = await azureOcr(g.image, config.AZURE_VISION_ENDPOINT, config.AZURE_VISION_KEY).catch(
        (e: unknown) => {
          req.log.warn(`azure ocr 실패: ${String(e).slice(0, 120)}`);
          return null;
        },
      );
    if (read === null) return reply.code(503).send({ error: 'no_ocr' });
    g.done();
    // 줄마다 사진 속 자리도 함께 — 웹이 사진 위에 번역을 덮는다 (2026-11-25)
    const rows = read.rows
      .map((r) => ({ ...r, text: r.text.trim().slice(0, 200) }))
      .filter((r) => r.text)
      .slice(0, MAX_LINES);
    const lines = rows.map((r) => r.text);
    const ko = lines.length
      ? await translateLines(providers, lines, (engine, err) =>
          req.log.warn({ engine, err: String(err) }, 'photo translate failed'),
        )
      : [];
    const result: PhotoTranslation = {
      lines: rows.map((r, i) => ({ ...r, ko: ko?.[i] ?? null })),
      left: g.left,
    };
    return result;
  });

  // 글만 번역 (영수증 품목 이름 → 한국어, 2026-11-25 사용자 요청 — ADR-0012 추가).
  // 사진은 받지 않는다. 영수증에서 읽은 줄 글자만 무료 AI로, 결과는 저장·기록하지 않는다
  const textUsage = userDailyRepo(db, 'translate_text');
  app.post<{ Body: { lines?: unknown } }>(
    '/api/vision/translate-text',
    { preHandler: requireUser(db), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      reply.header('cache-control', 'no-store');
      const raw = req.body?.lines;
      if (
        !Array.isArray(raw) ||
        raw.length === 0 ||
        raw.length > TRANSLATE_TEXT_MAX_LINES ||
        !raw.every((l) => typeof l === 'string')
      )
        return reply.code(400).send({ error: 'bad_request' });
      const userId = req.user!.userId;
      const n = textUsage.used(userId);
      if (n >= TRANSLATE_TEXT_DAILY)
        return reply
          .code(429)
          .send({ error: 'translate_daily', limit: TRANSLATE_TEXT_DAILY, left: 0 });
      const lines = (raw as string[]).map((l) => l.trim().slice(0, 200));
      const ko = await translateLines(providers, lines, (engine, err) =>
        req.log.warn({ engine, err: String(err) }, 'text translate failed'),
      );
      if (!ko) return reply.code(503).send({ error: 'no_ai' });
      textUsage.bump(userId);
      return { ko, left: TRANSLATE_TEXT_DAILY - n - 1 };
    },
  );

  const names =
    (feature: 'landmark' | 'labels') => async (req: FastifyRequest, reply: FastifyReply) => {
      const g = gate(feature, req, reply);
      if (!g) return reply;
      const key = gkey();
      const api = feature === 'landmark' ? 'google_vision_landmark' : 'google_vision_labels';
      if (!key || !apiAllowed(api)) return reply.code(503).send({ error: 'unavailable', api });
      try {
        const list = await googleVisionNames(
          g.image,
          key,
          feature === 'landmark' ? 'LANDMARK_DETECTION' : 'LABEL_DETECTION',
        );
        g.done();
        const result: VisionNames = { names: list, left: g.left };
        return result;
      } catch (e) {
        req.log.warn(`vision ${feature} 실패: ${String(e).slice(0, 120)}`);
        return reply.code(503).send({ error: 'unavailable', api });
      }
    };
  app.post('/api/vision/landmark', opts, names('landmark'));
  app.post('/api/vision/labels', opts, names('labels'));
}
