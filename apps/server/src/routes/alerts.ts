import { POINT_ALERT_COUNTRIES } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { alertsFor } from '../services/alerts';

/**
 * 여행지 기상·재난 특보 (docs/24, ADR-0008): GET /api/alerts?countries=JP,TW&points=JP:35.7:139.7 (로그인 필요).
 * 나라 코드 + (일본·미국만) 목적지 도시 좌표를 소수 1자리(약 10km)로 줄인 것 "JP:35.7:139.7".
 * 사용자 현재 위치가 아니며 저장·기록하지 않는다
 */
export function parsePoints(
  raw: string,
  countries: readonly string[],
): Map<string, [number, number][]> | null {
  const out = new Map<string, [number, number][]>();
  if (!raw) return out;
  const parts = raw.split(',');
  if (parts.length > 6) return null;
  for (const part of parts) {
    const m = /^([A-Z]{2}):(-?\d{1,2}(?:\.\d)?):(-?\d{1,3}(?:\.\d)?)$/.exec(part);
    if (!m || !POINT_ALERT_COUNTRIES.includes(m[1]!) || !countries.includes(m[1]!)) return null;
    const lat = Number(m[2]);
    const lng = Number(m[3]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    out.set(m[1]!, [...(out.get(m[1]!) ?? []), [lat, lng]]);
  }
  return out;
}

export function alertRoutes(app: FastifyInstance, config: Config, db: Db): void {
  app.get<{ Querystring: { countries?: string; points?: string } }>(
    '/api/alerts',
    { preHandler: requireUser(db), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const countries = [
        ...new Set((req.query.countries ?? '').toUpperCase().split(',').filter(Boolean)),
      ];
      if (
        !countries.length ||
        countries.length > 10 ||
        !countries.every((c) => /^[A-Z]{2}$/.test(c))
      )
        return reply.code(400).send({ error: 'bad_request' });
      const points = parsePoints(req.query.points ?? '', countries);
      if (!points) return reply.code(400).send({ error: 'bad_request' });
      reply.header('cache-control', 'private, max-age=300');
      return alertsFor(
        countries,
        { dataGoKr: config.DATA_GO_KR_KEY, cwa: config.CWA_API_KEY },
        points,
      );
    },
  );
}
