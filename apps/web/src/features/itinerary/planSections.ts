import { type LocalDate } from '@trippocket/shared';

export type Section = { date: LocalDate | null; index: number };
export type Group = { kind: 'days' | 'empty-run'; key: string; days: Section[] };

/** 전체 보기: 이어진 빈 날이 3일 이상이면 한 묶음으로 (하루 보기·가고 싶은 곳은 그대로) */
export function groupEmptyDays(
  sections: readonly Section[],
  isEmpty: (d: LocalDate) => boolean,
  allView: boolean,
): Group[] {
  const out: Group[] = [];
  let run: Section[] = [];
  const flush = () => {
    if (run.length >= 3) out.push({ kind: 'empty-run', key: run[0]!.date!, days: run });
    else if (run.length) out.push({ kind: 'days', key: run[0]!.date!, days: run });
    run = [];
  };
  for (const s of sections) {
    if (allView && s.date && isEmpty(s.date)) {
      run.push(s);
      continue;
    }
    flush();
    out.push({ kind: 'days', key: s.date ?? 'wish', days: [s] });
  }
  flush();
  return out;
}
