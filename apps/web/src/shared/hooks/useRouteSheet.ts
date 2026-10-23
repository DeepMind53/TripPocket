import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

interface SheetState {
  sheet?: string;
}

/**
 * 바텀시트 열림 상태를 히스토리에 연결한다 (docs/05 §7 "뒤로 가기 → 시트 닫기 우선").
 * 열면 같은 주소로 히스토리를 하나 쌓고, 휴대폰 뒤로가기·스와이프로 닫힌다.
 * 새로고침해도 히스토리 state가 남아 시트가 다시 열린 상태로 복원된다.
 */
export function useRouteSheet(key: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const open = (location.state as SheetState | null)?.sheet === key;

  const setOpen = useCallback(
    (next: boolean) => {
      if (next && !open) {
        void navigate(
          { pathname: location.pathname, search: location.search, hash: location.hash },
          { state: { sheet: key } satisfies SheetState },
        );
      } else if (!next && open) {
        void navigate(-1);
      }
    },
    [open, key, navigate, location.pathname, location.search, location.hash],
  );

  /** 이 시트를 닫고 다른 시트를 같은 히스토리 자리에 연다 (닫기·열기를 따로 하면 뒤로 가기가 새 시트를 지워 버림) */
  const switchTo = useCallback(
    (other: string) =>
      void navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { state: { sheet: other } satisfies SheetState, replace: true },
      ),
    [navigate, location.pathname, location.search, location.hash],
  );

  return [open, setOpen, switchTo] as const;
}
