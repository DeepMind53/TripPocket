import { buildApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db/database';
import { scheduleFx } from './services/fx';
import { scheduleMaintenance } from './services/maintenance';
import { initPush } from './services/push';
import { schedulePushes } from './services/pushScheduler';

/** 서버 시작: 설정 확인 → DB(마이그레이션) → 127.0.0.1에서 대기 */
const config = loadConfig();
const db = openDb(config.DATA_DIR);
const app = await buildApp(config, db);

const close = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());

await app.listen({ host: config.HOST, port: config.PORT });

// 오래된 세션·사용량 기록 정리 + SQLite 가볍게 (6시간마다)
scheduleMaintenance(db, (m) => app.log.warn(m));

// 알림 (VAPID 키가 있을 때만) — 출발 전·입국신고·일정 30분 전
if (initPush(config)) schedulePushes(db, (m) => app.log.warn(m));

// 환율 받기 (키가 있을 때만)
if (config.EXIM_API_KEY) scheduleFx(db, config.EXIM_API_KEY, (m) => app.log.warn(m));
