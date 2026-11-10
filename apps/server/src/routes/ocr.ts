import { OCR_DAILY_LIMIT, OCR_MAX_BYTES, type OcrResult } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { userDailyRepo } from '../repositories/userDailyRepo';
import { apiAllowed } from '../services/apiUsage';
import { azureOcr, googleOcr } from '../services/ocr';

/**
 * 영수증 글자 인식 (ADR-0012, 실험실 "사진·영수증" — 2026-11-11). 로그인 필요, 사람마다 하루 20장.
 * 사진(JPEG)은 본문으로만 받아 Google → Azure 순으로 보내고, 저장·로그하지 않는다. 결과 글만 돌려준다.
 * 둘 다 안 되면 503 no_ocr — 웹이 기기 안 글자 인식(Tesseract)으로 대신한다 (한도 팝업 없음)
 */
export function ocrRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const usage = userDailyRepo(db, 'ocr');
  app.post(
    '/api/ocr',
    {
      preHandler: requireUser(db),
      bodyLimit: OCR_MAX_BYTES,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      reply.header('cache-control', 'no-store');
      if (req.headers['content-type'] !== 'image/jpeg' || !Buffer.isBuffer(req.body))
        return reply.code(400).send({ error: 'bad_request' });
      const image = req.body;
      if (image.length === 0) return reply.code(400).send({ error: 'bad_request' });
      if (image.length > OCR_MAX_BYTES) return reply.code(413).send({ error: 'too_large' });
      const userId = req.user!.userId;
      const n = usage.used(userId);
      if (n >= OCR_DAILY_LIMIT)
        return reply.code(429).send({ error: 'ocr_daily', limit: OCR_DAILY_LIMIT, left: 0 });
      const gkey = config.GOOGLE_VISION_KEY ?? config.GOOGLE_PLACES_KEY;
      const tries: [OcrResult['source'], () => Promise<string>][] = [];
      if (gkey && apiAllowed('google_vision')) tries.push(['google', () => googleOcr(image, gkey)]);
      if (config.AZURE_VISION_ENDPOINT && config.AZURE_VISION_KEY && apiAllowed('azure_read')) {
        const { AZURE_VISION_ENDPOINT: ep, AZURE_VISION_KEY: key } = config;
        tries.push(['azure', () => azureOcr(image, ep, key)]);
      }
      for (const [source, run] of tries) {
        try {
          const text = await run();
          usage.bump(userId);
          const result: OcrResult = { text, source, left: OCR_DAILY_LIMIT - n - 1 };
          return result;
        } catch (e) {
          // 오류 이름만 (사진·글은 남기지 않는다)
          req.log.warn(`${source} ocr 실패: ${String(e).slice(0, 120)}`);
        }
      }
      return reply.code(503).send({ error: 'no_ocr', left: OCR_DAILY_LIMIT - n });
    },
  );
}
