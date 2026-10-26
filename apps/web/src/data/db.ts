import { assertEditable } from './tripRoles';
import Dexie, { type EntityTable } from 'dexie';
import { upgradeToV2 } from './migrations/v2';
import { upgradeToV6 } from './migrations/v6';
import type {
  Booking,
  ChecklistItem,
  ChecklistTemplate,
  ItineraryItem,
  SavedPlace,
  Trip,
} from '@trippocket/shared';

/** 서버에 아직 보내지 않은 변경 표시 (로컬 전용, 15단계 동기화에서 사용) */
export type Dirty = 0 | 1;
export type Stored<T> = T & { dirty: Dirty };

/**
 * 예약 문서 (이티켓·바우처 PDF·사진, docs/20 G2) — 기기에 파일째 저장.
 * remote = 서버에도 있음 (여행이 끝나면 서버에서는 지워지고 기기에만 남는다)
 */
export interface AttachmentRow {
  id: string;
  tripId: string;
  bookingId: string;
  name: string;
  mime: string;
  size: number;
  /** 파일 내용 (아직 안 받았으면 없음) */
  blob?: Blob;
  createdAt: string;
  remote: 0 | 1;
}

export interface KeyValueRow {
  key: string;
  value: unknown;
}

/**
 * 기기 저장소 (IndexedDB). 스키마: docs/04-data-model.md §4
 * - 기존 version 블록은 절대 수정하지 않는다. 바꿀 때는 version(N+1) + 마이그레이션 + 테스트 (CLAUDE.md)
 * - date가 null인 일정('가고 싶은 곳')은 [tripId+date] 인덱스에 들어가지 않으므로 tripId로 조회한다.
 * - 이 모듈은 repositories만 import 한다. 컴포넌트에서 직접 쓰지 않는다.
 */
export class TripPocketDB extends Dexie {
  trips!: EntityTable<Stored<Trip>, 'id'>;
  items!: EntityTable<Stored<ItineraryItem>, 'id'>;
  bookings!: EntityTable<Stored<Booking>, 'id'>;
  checklistItems!: EntityTable<Stored<ChecklistItem>, 'id'>;
  savedPlaces!: EntityTable<Stored<SavedPlace>, 'id'>;
  checklistTemplates!: EntityTable<Stored<ChecklistTemplate>, 'id'>;
  settings!: EntityTable<KeyValueRow, 'key'>;
  syncState!: EntityTable<KeyValueRow, 'key'>;
  attachments!: EntityTable<AttachmentRow, 'id'>;

  constructor(name = 'trippocket') {
    super(name);
    this.version(1).stores({
      trips: 'id, startDate, updatedAt, dirty',
      items: 'id, tripId, [tripId+date], updatedAt, dirty',
      bookings: 'id, tripId, [tripId+kind], updatedAt, dirty',
      checklistItems: 'id, tripId, [tripId+list], updatedAt, dirty',
      savedPlaces: 'id, cityTag, updatedAt, dirty',
      settings: 'key',
      syncState: 'key',
    });
    // v2 (9단계): 여행 목적지를 문자열 → 객체(이름·종류·국가·좌표·시간대). 인덱스는 그대로
    this.version(2).stores({}).upgrade(upgradeToV2);
    // v3 (9단계): 사용자가 고칠 수 있는 준비물·할 일 템플릿
    this.version(3).stores({ checklistTemplates: 'id, list, updatedAt, dirty' });
    // v4 (2026-10-25): 준비 목록 종류에 essentials(나라별 필수 항목) 추가 — 인덱스·기존 행은 그대로
    this.version(4).stores({});
    // v5 (2026-10-25): 예약 문서 파일 (동기화·백업 대상 아님 — 서버 API로 따로 주고받음)
    this.version(5).stores({ attachments: 'id, tripId, bookingId' });
    // v6 (2026-10-26): 일정 방문 기록(visit) — 인덱스는 그대로, 다녀옴 일정은 방문으로
    this.version(6).stores({}).upgrade(upgradeToV6);
  }
}

export const db = new TripPocketDB();

/**
 * 보기 전용으로 공유받은 여행은 이 기기에서도 고치지 못한다 (data/tripRoles.ts).
 * 기기에서 고친 행(dirty = 1)만 확인 — 동기화로 받은 행(dirty = 0)은 그대로 저장
 */
const tripScoped = {
  trips: (key: unknown) => String(key),
  items: (_: unknown, row?: { tripId?: string }) => row?.tripId,
  bookings: (_: unknown, row?: { tripId?: string }) => row?.tripId,
  checklistItems: (_: unknown, row?: { tripId?: string }) => row?.tripId,
} as const;
for (const [name, tripOf] of Object.entries(tripScoped)) {
  const table = db.table(name);
  table.hook('creating', (key, row: { id?: string; dirty?: number; tripId?: string }) => {
    if (row.dirty === 1) assertEditable(tripOf(key ?? row.id, row));
  });
  table.hook(
    'updating',
    (mods: { dirty?: number }, key, row: { dirty?: number; tripId?: string }) => {
      if ((mods.dirty ?? row.dirty) === 1) assertEditable(tripOf(key, row));
      return undefined;
    },
  );
}

/** 저장 레코드에서 로컬 전용 필드를 떼어 도메인 객체로 */
export function toDomain<T>(row: Stored<T>): T {
  const { dirty, ...rest } = row;
  return rest as T;
}
