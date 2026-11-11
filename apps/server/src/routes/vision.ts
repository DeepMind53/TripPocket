import {
  OCR_MAX_BYTES,
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
import { azureOcr, googleOcr, googleVisionNames } from '../services/ocr';

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
    let text: string | null = null;
    const key = gkey();
    if (key && apiAllowed('google_vision'))
      text = await googleOcr(g.image, key).catch((e: unknown) => {
        req.log.warn(`google ocr 실패: ${String(e).slice(0, 120)}`);
        return null;
      });
    if (
      text === null &&
      config.AZURE_VISION_ENDPOINT &&
      config.AZURE_VISION_KEY &&
      apiAllowed('azure_read')
    )
      text = await azureOcr(g.image, config.AZURE_VISION_ENDPOINT, config.AZURE_VISION_KEY).catch(
        (e: unknown) => {
          req.log.warn(`azure ocr 실패: ${String(e).slice(0, 120)}`);
          return null;
        },
      );
    if (text === null) return reply.code(503).send({ error: 'no_ocr' });
    g.done();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, MAX_LINES);
    const ko = lines.length
      ? await translateLines(providers, lines, (engine, err) =>
          req.log.warn({ engine, err: String(err) }, 'photo translate failed'),
        )
      : [];
    const result: PhotoTranslation = {
      lines: lines.map((t, i) => ({ text: t, ko: ko?.[i] ?? null })),
      left: g.left,
    };
    return result;
  });

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
