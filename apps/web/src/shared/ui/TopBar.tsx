import { ArrowLeft, House } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useNavigate } from 'react-router';
import { IconButton } from './IconButton';

export interface TopBarProps {
  title: string;
  /** 제목 아래 보조줄 (예: "10.24 (금) – 10.28 (화) · D-2") */
  subtitle?: string;
  /** 뒤로 버튼 표시. 히스토리가 없으면 fallback 경로로 이동 */
  backTo?: string;
  /** 오른쪽 버튼들 */
  actions?: ReactNode;
}

/**
 * 화면 상단 헤더. 스크롤해도 위에 고정된다.
 * 뒤로 버튼이 있는 화면에는 그 왼쪽에 홈 버튼을 항상 둔다 (어디서든 한 번에 홈으로 — 사용자 요청).
 */
export function TopBar({ title, subtitle, backTo, actions }: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function goBack() {
    // 공유 링크 등으로 바로 들어온 경우 뒤로 갈 곳이 없으므로 지정 경로로
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) void navigate(-1);
    else if (backTo) void navigate(backTo, { replace: true });
  }

  return (
    <header className="sticky top-[env(safe-area-inset-top)] z-20 flex min-h-14 items-center gap-1 bg-bg/95 px-1 backdrop-blur">
      {backTo !== undefined ? (
        <div className="flex shrink-0 items-center">
          <IconButton
            label={t('header.home')}
            icon={<House />}
            onClick={() => void navigate('/')}
          />
          <IconButton label={t('header.back')} icon={<ArrowLeft />} onClick={goBack} />
        </div>
      ) : (
        <span className="w-3" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-title-2">{title}</h1>
        {subtitle && <p className="tabular truncate text-caption text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center">{actions}</div>}
    </header>
  );
}
