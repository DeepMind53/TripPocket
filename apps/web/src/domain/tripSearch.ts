import {
  choseong,
  normalize,
  type Booking,
  type ChecklistItem,
  type ItineraryItem,
  type LocalDate,
} from '@trippocket/shared';

export type TripHitKind = 'item' | 'booking' | 'checklist';

export interface TripHit {
  kind: TripHitKind;
  id: string;
  title: string;
  /** 일정·예약 날짜 (가고 싶은 곳·준비물은 없음) */
  date?: LocalDate | null | undefined;
  /** 제목 밖에서 맞은 글 (주소·메모·예약번호) — 화면에 한 줄로 */
  matched?: string | undefined;
}

const MAX = 50;

/** 한 칸이 맞는지: 정규화한 글에 포함, 또는 초성만 친 경우 초성으로 */
function matches(q: string, text: string | undefined): boolean {
  if (!text) return false;
  const n = normalize(text);
  if (n.includes(q)) return true;
  return /^[ㄱ-ㅎ]+$/.test(q) && choseong(n).includes(q);
}

/**
 * 실험실 "여행 안 검색" (사용자 요청 2026-10-26): 일정·예약·메모·준비물을 한 번에.
 * 기기에 있는 것만 찾는다. 제목이 맞은 것 먼저, 같은 종류 안에서는 받은 순서(날짜 순) 그대로
 */
export function searchTrip(
  query: string,
  data: {
    items: readonly ItineraryItem[];
    bookings: readonly Booking[];
    checklist: readonly ChecklistItem[];
  },
): TripHit[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const byTitle: TripHit[] = [];
  const byOther: TripHit[] = [];
  const add = (hit: TripHit, titleHit: boolean) => (titleHit ? byTitle : byOther).push(hit);

  for (const i of data.items) {
    if (i.deletedAt) continue;
    const title = i.kind === 'note' ? (i.memo ?? i.title).split('\n')[0]! : i.title;
    const other = [i.place?.name, i.place?.address, i.memo].find((x) => matches(q, x));
    if (matches(q, title)) add({ kind: 'item', id: i.id, title, date: i.date }, true);
    else if (other) add({ kind: 'item', id: i.id, title, date: i.date, matched: other }, false);
  }
  for (const b of data.bookings) {
    if (b.deletedAt) continue;
    const other = [b.confirmationNo, b.details?.address, b.start.place, b.end?.place].find((x) =>
      matches(q, x),
    );
    if (matches(q, b.title))
      add({ kind: 'booking', id: b.id, title: b.title, date: b.start.date }, true);
    else if (other)
      add({ kind: 'booking', id: b.id, title: b.title, date: b.start.date, matched: other }, false);
  }
  for (const c of data.checklist) {
    // essentials는 "나라:항목" 키라 사람이 읽는 글이 아니다
    if (c.deletedAt || c.list === 'essentials') continue;
    if (matches(q, c.text)) add({ kind: 'checklist', id: c.id, title: c.text }, true);
  }
  return [...byTitle, ...byOther].slice(0, MAX);
}
