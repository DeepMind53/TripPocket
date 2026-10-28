import { Check } from 'lucide-react';
import { useLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { memoLines, toggleMemoLine } from '../../domain/travelExtras';
import { cn } from '../../shared/lib/cn';

/**
 * 일정 상세의 메모. 실험실 "메모 체크박스"(2026-10-28)를 켜면 "- "로 시작하는 줄을 눌러 체크한다
 * (메모 글에 "- [x]"로 남아 동기화·백업도 그대로). 보기 전용이면 누를 수 없다
 */
export function MemoText({
  itemId,
  memo,
  readOnly,
}: {
  itemId: string;
  memo: string;
  readOnly: boolean;
}) {
  const on = useLab('memoChecklist');
  const lines = memoLines(memo);
  if (!on || lines.every((l) => l.checked === null)) return <>{memo}</>;
  return (
    <span className="flex flex-col gap-1 whitespace-normal">
      {lines.map((l, n) =>
        l.checked === null ? (
          <span key={n} className="whitespace-pre-wrap">
            {l.text || ' '}
          </span>
        ) : (
          <button
            key={n}
            type="button"
            role="checkbox"
            aria-checked={l.checked}
            disabled={readOnly}
            onClick={() => void itemRepo.update(itemId, { memo: toggleMemoLine(memo, n) })}
            className="flex min-h-9 items-center gap-2 text-left"
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded border',
                l.checked ? 'border-primary bg-primary text-white' : 'border-line bg-surface',
              )}
            >
              {l.checked && <Check className="size-3.5" />}
            </span>
            <span className={cn(l.checked && 'text-fg-muted line-through')}>{l.text}</span>
          </button>
        ),
      )}
    </span>
  );
}
