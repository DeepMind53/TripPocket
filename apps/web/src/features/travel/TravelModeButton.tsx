import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLab } from '../../data/labsStore';
import { setTravelMode } from '../../data/travelModeStore';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/**
 * 여행 모드 켜기 버튼 (사용자 요청 2026-11-04): 홈 왼쪽 위·빠른 메뉴 제목 오른쪽에 작게.
 * 실험실 "여행 모드"를 켰을 때만. 누르면 그 여행의 여행 모드 화면으로 (메뉴 기록 자리는 바꿔서 뒤로 가면 원래 화면)
 */
export function TravelModeButton({
  tripId,
  className,
  replace = false,
}: {
  tripId: string | undefined;
  className?: string;
  replace?: boolean;
}) {
  const on = useLab('travelMode');
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!on || !tripId) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setTravelMode(tripId, true);
        void navigate(`/trips/${tripId}/go`, { replace });
      }}
      className={cn(
        'flex min-h-9 items-center gap-1 rounded-full bg-primary-weak px-2.5 text-caption font-semibold whitespace-nowrap text-primary active:brightness-95',
        className,
      )}
    >
      <Compass aria-hidden="true" className="size-4" />
      {t('travel.title')}
    </button>
  );
}
