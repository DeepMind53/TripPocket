import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from '../../i18n';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { FloatingQuickButton } from './FloatingQuickButton';
import { useSettings } from '../../data/settingsStore';
import type { QuickMenuSheets as Sheets } from './QuickMenuSheets';

const SHEET_KEY = 'quick-menu';

// 메뉴 내용(바로가기·빠른 설정·길찾기 시트)은 첫 화면에 넣지 않는다:
// 화면이 한가해지면 미리 받아 두고, 그 전에 누르면 그때 받는다
type SheetsProps = Parameters<typeof Sheets>[0];
let Loaded: ComponentType<SheetsProps> | null = null;
// eslint-disable-next-line react-refresh/only-export-components -- 미리 받기 함수(시험 준비에서도 씀), 개발 중 새로고침 방식에만 영향
export const preloadQuickMenu = () =>
  import('./QuickMenuSheets').then((m) => (Loaded = m.QuickMenuSheets));
const Lazy = lazy(async () => ({ default: await preloadQuickMenu() }));

/** ⚡ 플로팅 버튼(끌어서 옮김) + 빠른 메뉴 시트 (docs/12 §1). 화면마다 같은 자리에 뜬다 */
export function QuickMenuButton({ inTrip = false }: { inTrip?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useRouteSheet(SHEET_KEY);
  const [used, setUsed] = useState(open);
  if (open && !used) setUsed(true);
  useEffect(() => {
    if (Loaded) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    idle(() => void preloadQuickMenu());
  }, []);
  const props = { inTrip, open, setOpen };
  // 설정에서 ⚡ 버튼을 끌 수 있다 (빠른 메뉴는 설정 화면의 "빠른 메뉴 열기"로)
  const visible = useSettings((s) => s.quickButton);
  return (
    <>
      {visible && <FloatingQuickButton label={t('quickMenu.title')} onOpen={() => setOpen(true)} />}
      {used &&
        (Loaded ? (
          <Loaded {...props} />
        ) : (
          <Suspense fallback={null}>
            <Lazy {...props} />
          </Suspense>
        ))}
    </>
  );
}
