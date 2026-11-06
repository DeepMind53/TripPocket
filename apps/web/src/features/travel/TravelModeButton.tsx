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
  compact = false,
}: {
  tripId: string | undefined;
  className?: string;
  replace?: boolean;
  /** 홈 머리처럼 좁은 칸: 글씨·여백을 줄인다 (아이폰에서 잘리던 문제, 2026-11-06) */
  compact?: boolean;
}) {
  const on = useLab('travelMode');
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!on || !tripId) return null;
  return (
    <button
      type="button"
      aria-label={t('travel.title')}
      onClick={() => {
        setTravelMode(tripId, true);
        void navigate(`/trips/${tripId}/go`, { replace });
      }}
      className={cn(
        'flex min-h-9 shrink-0 items-center rounded-full bg-primary-weak font-semibold whitespace-nowrap text-primary active:brightness-95',
        compact ? 'gap-0.5 px-2 text-micro' : 'gap-1 px-2.5 text-caption',
        className,
      )}
    >
      <Compass aria-hidden="true" className="size-4" />
      {/* 아주 좁은 화면·큰 글씨에서는 홈 머리 버튼을 그림만 (로고와 겹치지 않게) */}
      <span className={compact ? 'tight:sr-only' : undefined}>{t('travel.title')}</span>
    </button>
  );
}
