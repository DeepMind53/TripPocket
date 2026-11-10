import type { Trip } from '@trippocket/shared';
import { PenLine } from 'lucide-react';
import { useState } from 'react';
import { tripRepo } from '../../data/repositories/tripRepo';
import { DAY_NOTE_MAX, setDayNote } from '../../domain/dayNotes';
import { useTranslation } from '../../i18n';

/**
 * 하루 한 줄 기록 (실험실 dayNote, 2026-11-10): 오늘·지난 날 일정 아래 한 줄. 저장 버튼 없이 칸을 벗어나면 저장
 * (docs/12 §3.1 즉시 적용). 여행에 함께 저장돼 동기화·백업된다. 다른 기기에서 바뀌면 부모가 key로 새로 그린다
 */
export function DayNoteField({ trip, date }: { trip: Trip; date: string }) {
  const { t } = useTranslation();
  const saved = trip.dayNotes?.find((n) => n.date === date)?.text ?? '';
  const [text, setText] = useState(saved);
  const save = () => {
    if (text.trim() === saved) return;
    void tripRepo.update(trip.id, { dayNotes: setDayNote(trip.dayNotes, date, text) });
  };
  return (
    <label className="mb-2 flex items-center gap-2 rounded-btn bg-bg-subtle px-3">
      <PenLine aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      <span className="sr-only">{t('dayNote.label')}</span>
      <input
        type="text"
        value={text}
        maxLength={DAY_NOTE_MAX}
        enterKeyHint="done"
        placeholder={t('dayNote.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="h-11 min-w-0 flex-1 bg-transparent text-body-2 outline-none placeholder:text-fg-muted"
      />
    </label>
  );
}
