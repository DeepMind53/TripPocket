import { ArrowLeft, House } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
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
  /** 제목 줄 가운데 (예: 마이의 동기화 상태) */
  center?: ReactNode;
}

/**
 * 화면 상단 헤더. 스크롤해도 위에 고정된다.
 * 뒤로 버튼이 있는 화면에는 그 왼쪽에 홈 버튼을 항상 둔다 (어디서든 한 번에 홈으로 — 사용자 요청).
 */
export function TopBar({ title, subtitle, backTo, actions, center }: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const header = useRef<HTMLElement>(null);

  // 제목이 2줄이면 머리가 높아진다 → 그 아래 고정되는 줄이 가려지지 않게 실제 높이를 알린다
  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty('--topbar-h', `${el.offsetHeight}px`),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--topbar-h');
    };
  }, []);

  function goBack() {
    // 공유 링크 등으로 바로 들어온 경우 뒤로 갈 곳이 없으므로 지정 경로로
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) void navigate(-1);
    else if (backTo) void navigate(backTo, { replace: true });
  }

  return (
    <header
      ref={header}
      className="sticky top-0 z-20 flex min-h-[calc(56px+var(--safe-top))] pt-[var(--safe-top)] items-center gap-1 bg-bg/95 px-1 backdrop-blur tight:flex-wrap"
    >
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
      <div className="min-w-0 flex-1 tight:order-last tight:basis-full tight:px-3 tight:pb-1">
        <h1 className="line-clamp-2 text-title-2">{title}</h1>
        {subtitle && <p className="tabular truncate text-caption text-fg-muted">{subtitle}</p>}
      </div>
      {center && (
        <div className="pointer-events-none absolute inset-x-0 top-[var(--safe-top)] flex h-14 items-center justify-center">
          <div className="pointer-events-auto">{center}</div>
        </div>
      )}
      {actions && <div className="ml-auto flex shrink-0 items-center">{actions}</div>}
    </header>
  );
}
