import { useTranslation } from '../../i18n';
import { BottomSheet } from '../../shared/ui';
import { TripRouteView, type RouteDay } from './TripRouteView';

/** 일정 화면 [노선도] 시트 (실험실 tripRouteMap) — 누를 때만 불러온다 */
export function TripRouteSheet({
  open,
  onOpenChange,
  days,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: readonly RouteDay[];
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('routeMap.title')}>
      <div className="pb-2">
        <TripRouteView days={days} />
      </div>
    </BottomSheet>
  );
}
