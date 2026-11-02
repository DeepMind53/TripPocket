import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { lookupFlight } from '../services/flights';
import {
  ICN_DAYS_AFTER,
  ICN_DAYS_BEFORE,
  icnSide,
  KAC_AIRPORTS,
  kacSide,
  type AirportSide,
} from '../services/airportInfo';

/** 편명으로 항공편 불러오기 (로그인 필요, 사람당 분당 10회) — services/flights.ts */
export function flightRoutes(app: FastifyInstance, config: Config, db: Db): void {
  app.get<{ Params: { flightNo: string } }>(
    '/api/flights/:flightNo',
    { preHandler: requireUser(db), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!config.AVIATIONSTACK_KEY) return reply.code(503).send({ error: 'not_configured' });
      const flightNo = req.params.flightNo.replace(/\s+/g, '').toUpperCase();
      // 항공사 코드 2자(숫자 섞일 수 있음) + 편 번호 1~4자리
      if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flightNo))
        return reply.code(400).send({ error: 'bad_flight_no' });
      const info = await lookupFlight(config.AVIATIONSTACK_KEY, flightNo);
      if (!info) return reply.code(404).send({ error: 'not_found' });
      return info;
    },
  );

  // 국내 공항 터미널·체크인 카운터·게이트·수하물 수취대 (공공데이터포털, 사용자 요청 2026-11-02).
  // 값은 바뀔 수 있어 저장하지 않는다 — 앱이 확인 시각과 함께 보여 주고 전날 다시 확인하라고 안내
  const cache = new Map<string, { exp: number; value: AirportSide | null }>();
  const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const dayDiff = (a: string, b: string) =>
    Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
  app.get<{
    Params: { flightNo: string };
    Querystring: { date?: string; from?: string; to?: string; arrDate?: string };
  }>(
    '/api/flights/:flightNo/airport',
    { preHandler: requireUser(db), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const key = config.DATA_GO_KR_KEY;
      if (!key) return reply.code(503).send({ error: 'not_configured' });
      const flightNo = req.params.flightNo.replace(/\s+/g, '').toUpperCase();
      const { date = '', from = '', to = '' } = req.query;
      const arrDate = req.query.arrDate || date;
      const iata = /^[A-Z]{3}$/;
      if (
        !/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flightNo) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(arrDate) ||
        (from && !iata.test(from)) ||
        (to && !iata.test(to))
      )
        return reply.code(400).send({ error: 'bad_request' });
      const today = kstToday();
      /** 한쪽 공항: 인천은 3일 전~6일 후, 한국공항공사는 오늘만. 범위 밖이면 언제부터 되는지 */
      const side = async (
        airport: string,
        day: string,
        io: 'dep' | 'arr',
      ): Promise<{ info?: AirportSide | null; from?: string } | null> => {
        const diff = dayDiff(day, today);
        const icn = airport === 'ICN';
        if (!icn && !KAC_AIRPORTS.has(airport)) return null;
        if (icn ? diff > ICN_DAYS_AFTER || diff < -ICN_DAYS_BEFORE : diff !== 0)
          return {
            from: new Date(Date.parse(day) - (icn ? ICN_DAYS_AFTER : 0) * 86_400_000)
              .toISOString()
              .slice(0, 10),
          };
        const k = `${airport}|${flightNo}|${day}|${io}`;
        const hit = cache.get(k);
        if (hit && hit.exp > Date.now()) return { info: hit.value };
        try {
          const info = icn
            ? await icnSide(key, flightNo, day, io)
            : await kacSide(key, flightNo, airport, io);
          cache.set(k, { exp: Date.now() + 10 * 60_000, value: info });
          if (cache.size > 300) cache.delete(cache.keys().next().value!);
          return { info };
        } catch (e) {
          req.log.warn({ err: String(e) }, 'airport info failed');
          return { info: null };
        }
      };
      const [dep, arr] = await Promise.all([
        from ? side(from, date, 'dep') : null,
        to ? side(to, arrDate, 'arr') : null,
      ]);
      reply.header('cache-control', 'no-store');
      return { checkedAt: new Date().toISOString(), dep, arr };
    },
  );
}
