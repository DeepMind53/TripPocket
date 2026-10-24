import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import type { BottomSheetProps } from './BottomSheetImpl';

export type { BottomSheetProps } from './BottomSheetImpl';

// 시트(Radix Dialog·스크롤 잠금 등 약 10KB)는 첫 화면에 넣지 않는다:
// 화면이 한가해지면 미리 받아 두고(첫 열기도 바로 뜸), 그 전에 열면 그때 받는다
let Loaded: ComponentType<BottomSheetProps> | null = null;
// eslint-disable-next-line react-refresh/only-export-components -- 미리 받기 함수(시험 준비에서도 씀), 개발 중 새로고침 방식에만 영향
export const preloadBottomSheet = () =>
  import('./BottomSheetImpl').then((m) => (Loaded = m.BottomSheetImpl));
const Lazy = lazy(async () => ({ default: await preloadBottomSheet() }));
let preloading = false;

/** 모바일 편집 폼용 바텀시트 (docs/11 §7) — 실제 구현은 BottomSheetImpl.tsx */
export function BottomSheet(props: BottomSheetProps) {
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true);
  useEffect(() => {
    if (preloading || Loaded) return;
    preloading = true;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void preloadBottomSheet());
  }, []);
  // 한 번 연 뒤에는 계속 그려 둔다 (닫히는 애니메이션·포커스 되돌리기)
  if (!used) return null;
  if (Loaded) return <Loaded {...props} />;
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
