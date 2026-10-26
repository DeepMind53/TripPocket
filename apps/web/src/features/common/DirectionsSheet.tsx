import { useTranslation } from '../../i18n';
import type { Destination } from '../../shared/lib/directions';
import { BottomSheet } from '../../shared/ui';
import { DirectionsPanel } from './DirectionsPanel';

export interface DirectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: Destination | null;
  /** 국내 여행이면 네이버·카카오, 해외면 구글 */
  isDomestic: boolean;
}

/** S-30 길찾기: 이동 방법 × 지도 앱 */
export function DirectionsSheet({
  open,
  onOpenChange,
  destination,
  isDomestic,
}: DirectionsSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={destination ? t('dir.title', { name: destination.name }) : t('detail.directions')}
      description={t('dir.hint')}
    >
      {destination && <DirectionsPanel destination={destination} isDomestic={isDomestic} />}
    </BottomSheet>
  );
}
