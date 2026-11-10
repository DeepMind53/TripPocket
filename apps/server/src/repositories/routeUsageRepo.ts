import type { Db } from '../db/database';
import { userDailyRepo } from './userDailyRepo';

/** 한 사람 하루 길 조회 한도 (자동 + [현재 위치] 합계, 사용자 결정 2026-11-10) */
export const ROUTE_DAILY_LIMIT = 50;

/** 길 조회 사용량 (POST /api/routes/eta) — 좌표는 받지 않는다, 사람 id·날짜·횟수만 */
export const routeUsageRepo = (db: Db) => userDailyRepo(db, 'route_eta');
