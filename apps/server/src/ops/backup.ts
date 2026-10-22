import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

/**
 * 서버 백업 파일 암호화 (docs/09 §7.4) — Node 내장 기능만 (7-Zip·age 설치 불필요).
 * 형식: "TPBK1" | salt 16 | iv 12 | tag 16 | AES-256-GCM(gzip(SQLite 파일))
 * 키는 BACKUP_KEY(문장)에서 scrypt로 만든다 — 잃어버리면 복구할 수 없으니 따로 적어 둘 것
 */
const MAGIC = Buffer.from('TPBK1');

const keyFrom = (passphrase: string, salt: Buffer) =>
  scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

export function encryptBackup(sqlite: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(gzipSync(sqlite)), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

/** 키가 틀리거나 파일이 바뀌었으면 오류 (GCM 인증) */
export function decryptBackup(file: Buffer, passphrase: string): Buffer {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error('트립포켓 백업 파일이 아니에요');
  let o = MAGIC.length;
  const salt = file.subarray(o, (o += 16));
  const iv = file.subarray(o, (o += 12));
  const tag = file.subarray(o, (o += 16));
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return gunzipSync(Buffer.concat([decipher.update(file.subarray(o)), decipher.final()]));
}

export const backupName = (d: Date) =>
  `trippocket-${d.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.tpbk`;

/**
 * 보관 정리 (docs/09 §7.4): 최근 7일은 하루 1개, 그 전 4주는 주 1개, 그 전 6개월은 달 1개 — 나머지는 지운다.
 * 입력: 파일 이름들(backupName 형식), 돌려줌: 지울 이름들
 */
export function pruneList(names: readonly string[], now: Date): string[] {
  const parsed = names
    .map((name) => {
      const m = /^trippocket-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.tpbk$/.exec(name);
      return m ? { name, t: Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) } : null;
    })
    .filter((x): x is { name: string; t: number } => x !== null)
    .sort((a, b) => b.t - a.t);
  const DAY = 86_400_000;
  const keep = new Set<string>();
  const seen = new Set<string>();
  for (const { name, t } of parsed) {
    const age = (now.getTime() - t) / DAY;
    const d = new Date(t);
    const bucket =
      age < 7
        ? `d${d.toISOString().slice(0, 10)}`
        : age < 35
          ? `w${Math.floor(t / (7 * DAY))}`
          : age < 35 + 183
            ? `m${d.toISOString().slice(0, 7)}`
            : null;
    if (bucket && !seen.has(bucket)) {
      seen.add(bucket);
      keep.add(name);
    }
  }
  return parsed.filter((p) => !keep.has(p.name)).map((p) => p.name);
}
