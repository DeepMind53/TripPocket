import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { emojiRows } from '../../shared/lib/emojiRows';

/**
 * 여행 이모지 고르기 (사용자 요청 2026-10-27): 첫 줄 = 여행 나라(국기 + 그 나라 5종), 다음 줄 = 공통 10종.
 * 순서가 고정이라 눌러도 자리가 바뀌지 않는다
 */
export function EmojiPicker({
  countryCodes,
  value,
  onChange,
}: {
  countryCodes: readonly string[];
  value: string;
  onChange: (emoji: string) => void;
}) {
  const { t } = useTranslation();
  const { country, common } = emojiRows(countryCodes, value);
  const row = (list: string[], label: string) =>
    list.length > 0 && (
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {list.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={e === value}
            onClick={() => onChange(e)}
            className={cn(
              'grid size-12 place-items-center rounded-btn border text-[24px]',
              e === value ? 'border-primary bg-primary-weak' : 'border-line bg-surface',
            )}
          >
            {e}
          </button>
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {row(country, t('newTrip.emojiCountry'))}
      {row(common, t('newTrip.emojiCommon'))}
    </div>
  );
}
