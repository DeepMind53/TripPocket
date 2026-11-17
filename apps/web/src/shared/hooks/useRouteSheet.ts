import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** 히스토리에 쌓는 시트 상태: 어떤 시트가 열렸고, 무엇(날짜·일정 등)을 대상으로 열렸나 */
interface SheetState {
  sheet?: string;
  /** 시트 대상 — 브라우저 기록에 함께 저장해 새로고침·앱 다시 그림 뒤에도 같은 대상으로 열린다.
   *  structuredClone 가능한 값만 (문자열·숫자·평범한 객체) */
  arg?: unknown;
}

/**
 * 바텀시트 열림 상태를 히스토리에 연결한다 (docs/05 §7 "뒤로 가기 → 시트 닫기 우선").
 * 열면 같은 주소로 히스토리를 하나 쌓고, 휴대폰 뒤로가기·스와이프로 닫힌다.
 * 새로고침해도 히스토리 state가 남아 시트가 다시 열린 상태로 복원된다.
 *
 * 대상이 있는 시트는 `setOpen(true, arg)`로 열고 `useSheetArg()`로 읽는다.
 * 열림과 대상을 따로(useState) 두면 새로고침 뒤 시트만 열리고 대상이 비어 엉뚱한 날·새 일정으로 열렸다 (2026-11-17)
 */
export function useRouteSheet(key: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SheetState | null;
  const open = state?.sheet === key;

  const setOpen = useCallback(
    (next: boolean, arg?: unknown) => {
      if (next && !open) {
        void navigate(
          { pathname: location.pathname, search: location.search, hash: location.hash },
          { state: { sheet: key, arg } satisfies SheetState },
        );
      } else if (!next && open) {
        void navigate(-1);
      }
    },
    [open, key, navigate, location.pathname, location.search, location.hash],
  );

  /** 이 시트를 닫고 다른 시트를 같은 히스토리 자리에 연다 (닫기·열기를 따로 하면 뒤로 가기가 새 시트를 지워 버림).
   *  대상은 그대로 넘긴다 (날짜 메뉴 → 그날 복제·붙여 넣기) */
  const switchTo = useCallback(
    (other: string, arg: unknown = state?.arg) =>
      void navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { state: { sheet: other, arg } satisfies SheetState, replace: true },
      ),
    [navigate, state?.arg, location.pathname, location.search, location.hash],
  );

  return [open, setOpen, switchTo] as const;
}

/** 지금 열린 시트와 그 대상 (시트가 없으면 sheet = undefined) */
export function useSheetState(): { sheet: string | undefined; arg: unknown } {
  const state = useLocation().state as SheetState | null;
  return { sheet: state?.sheet, arg: state?.arg };
}

/**
 * 이 시트들 중 하나가 열려 있으면 그 대상. 닫힌 뒤에도 마지막 대상을 그대로 돌려준다
 * (닫히는 동안 제목이 "가고 싶은 곳" 등으로 바뀌어 깜빡이지 않게). 한 번도 안 열렸으면 undefined
 */
export function useSheetArg<T>(keys: readonly string[]): T | undefined {
  const { sheet, arg } = useSheetState();
  const active = sheet !== undefined && keys.includes(sheet);
  const [last, setLast] = useState<{ arg: unknown } | undefined>(active ? { arg } : undefined);
  // 이전 렌더 값 기억하기 (React 문서 "storing information from previous renders")
  if (active && last?.arg !== arg) setLast({ arg });
  return (active ? arg : last?.arg) as T | undefined;
}
