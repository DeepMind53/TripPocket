import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { haptic } from '../../data/settingsStore';
import { copyText } from '../lib/clipboard';

const HOLD_MS = 550;
const MOVE_PX = 10;

/**
 * 꾹 눌러 복사 (2026-11-25 사용자 요청 "일정에서 장소 이름·주소를 꾹 누르면 복사"):
 * 0.55초 누르고 있으면 복사·진동·알림. 끌거나 스크롤하면 취소. 복사했을 때는 그 뒤 눌림(상세 열기)을 막는다.
 * 안드로이드 길게 누르기 메뉴·아이폰 글자 선택 말풍선도 막는다 (`select-none [-webkit-touch-callout:none]` 함께)
 */
export function useLongPressCopy(text: string | undefined, done: string) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  if (!text) return {};
  return {
    onPointerDown: (e: PointerEvent) => {
      // 일정 목록은 줄을 꾹 누르면 편집 모드 — 이름·주소에서는 복사만 하도록 위로 안 올린다
      e.stopPropagation();
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        haptic(20);
        void copyText(text, done);
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onClick: (e: MouseEvent) => {
      if (!fired.current) return;
      // 복사한 뒤 손을 떼며 생긴 눌림은 줄(상세 열기)로 올라가지 않게
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
