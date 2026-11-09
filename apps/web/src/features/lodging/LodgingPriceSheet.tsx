import { useTranslation } from '../../i18n';
import type { RecentStay } from '../../data/lodgingRecent';
import { BottomSheet } from '../../shared/ui';
import { LodgingPricePanel } from './LodgingPricePanel';

/**
 * 숙소 예약 추가·수정 시트 안에서 여는 최저가 (docs/28 Q5) — 화면을 옮기면 쓰던 예약 칸이 사라져 시트로 띄운다
 */
export function LodgingPriceSheet({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Partial<RecentStay>;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('lodgingPrice.title')}
      autoFocusInput={false}
    >
      <div className="pb-4">{open && <LodgingPricePanel initial={initial} />}</div>
    </BottomSheet>
  );
}
