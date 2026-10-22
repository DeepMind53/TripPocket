import Dexie, { type EntityTable } from 'dexie';
import { upgradeToV2 } from './migrations/v2';
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
  }
}

export const db = new TripPocketDB();

/** 저장 레코드에서 로컬 전용 필드를 떼어 도메인 객체로 */
export function toDomain<T>(row: Stored<T>): T {
  const { dirty, ...rest } = row;
  return rest as T;
}
