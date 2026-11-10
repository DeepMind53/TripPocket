import { setDayNote } from './dayNotes';

it('하루 한 줄: 날짜마다 하나, 공백 정리, 빈 글은 지움, 날짜 순', () => {
  let notes = setDayNote(undefined, '2026-11-12', '  야경이\n최고 ');
  expect(notes).toEqual([{ date: '2026-11-12', text: '야경이 최고' }]);
  notes = setDayNote(notes, '2026-11-11', '첫날');
  expect(notes.map((n) => n.date)).toEqual(['2026-11-11', '2026-11-12']);
  notes = setDayNote(notes, '2026-11-12', '바꿈');
  expect(notes).toHaveLength(2);
  expect(setDayNote(notes, '2026-11-11', '   ')).toEqual([{ date: '2026-11-12', text: '바꿈' }]);
  expect(setDayNote([], '2026-11-12', 'a'.repeat(200))[0]!.text).toHaveLength(140);
});
