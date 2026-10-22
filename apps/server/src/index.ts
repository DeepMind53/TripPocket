import { buildApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db/database';

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
