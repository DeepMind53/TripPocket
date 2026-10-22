import { db } from '../db';

/**
 * 앱 설정 (key-value). 10단계에서 Zod 스키마·기본값과 함께 정식 설정 화면에 연결한다.
 * 기기별 값이라 동기화 대상 아님 (계정 설정 동기화는 I8에서 결정).
 */
export const settingsRepo = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await db.settings.get(key);
    return row === undefined ? fallback : (row.value as T);
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value });
  },
};
