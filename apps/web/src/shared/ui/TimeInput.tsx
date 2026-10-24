import { parseTypedTime } from '@trippocket/shared';
import { Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../lib/cn';

/**
 * 시간 입력: 숫자로 바로 치거나("0930", "9:30") 시계 버튼으로 고른다 (사용자 요청 2026-10-24).
 * 값은 언제나 "HH:mm" 또는 빈 문자열. 다 친 순간(3~4자리·"시:분") 바로 반영, 나머지는 칸을 벗어날 때
 */
export function TimeInput({
  id,
  value,
  onChange,
  step,
  className,
  size = 'md',
  label,
}: {
  /** sm = 시트 머리글 등 좁은 자리 (높이 40) */
  size?: 'sm' | 'md';
  /** 보이는 라벨이 없을 때 읽어 줄 이름 */
  label?: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** 시계로 고를 때 간격 (초) */
  step?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const picker = useRef<HTMLInputElement>(null);
  // 바깥에서 값이 바뀌면(시계로 고름·초기화) 칸도 맞춘다 (렌더 중 맞추기 — effect 없이)
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  const complete = (s: string) => /^\d{3,4}$/.test(s.trim()) || /\d[:.시h]\d{2}/.test(s);
  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="09:30"
        maxLength={8}
        aria-label={label}
        value={draft}
        onChange={(e) => {
          const s = e.currentTarget.value;
          setDraft(s);
          if (!s.trim()) onChange('');
          else if (complete(s)) {
            const parsed = parseTypedTime(s);
            if (parsed) onChange(parsed);
          }
        }}
        onBlur={() => {
          const parsed = draft.trim() ? parseTypedTime(draft) : '';
          // 알아볼 수 없는 값이면 원래 값으로
          if (parsed === null) setDraft(value);
          else {
            setDraft(parsed);
            if (parsed !== value) onChange(parsed);
          }
        }}
        className={cn(
          'tabular w-full rounded-btn bg-bg-subtle pl-3',
          size === 'sm' ? 'h-10 pr-9 text-body-2' : 'h-12 pr-11 text-body-1',
        )}
      />
      <button
        type="button"
        aria-label={t('time.pick')}
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className={cn(
          'absolute inset-y-0 right-0 grid place-items-center text-fg-muted',
          size === 'sm' ? 'w-9' : 'w-11',
        )}
      >
        <Clock aria-hidden="true" className="size-5" />
      </button>
      {/* 시계 고르기용 (보이지 않음) */}
      <input
        ref={picker}
        type="time"
        tabIndex={-1}
        aria-hidden="true"
        step={step}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
      />
    </div>
  );
}
