/** 하루 한 줄 기록 (실험실 dayNote, 2026-11-10) — 날짜마다 한 줄, 빈 글은 지운다 */
export interface DayNote {
  date: string;
  text: string;
}

export const DAY_NOTE_MAX = 140;

/** 그 날짜의 한 줄을 바꾼 새 목록 (날짜 순). 앞뒤 공백·줄바꿈은 한 칸으로, 빈 글이면 그 날짜를 뺀다 */
export function setDayNote(
  notes: readonly DayNote[] | undefined,
  date: string,
  text: string,
): DayNote[] {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, DAY_NOTE_MAX);
  const rest = (notes ?? []).filter((n) => n.date !== date);
  return (clean ? [...rest, { date, text: clean }] : rest).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
