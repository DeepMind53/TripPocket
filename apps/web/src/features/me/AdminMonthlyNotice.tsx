import { todayIn } from '@trippocket/shared';
import { useState } from 'react';
import { useAuth } from '../../data/authStore';
import { shouldShowNotice } from '../../domain/monthlyNotice';
import { MonthlyUpdateSheet } from './MonthlyUpdateSheet';

/** 이번 달 안내를 띄웠음 (이 기기) */
const KEY = 'tp-monthly-notice';

function lastShown(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * 관리자에게만, 한 달에 한 번 무작위 날짜에 월간 정보 갱신 요청문을 띄운다 (사용자 요청 2026-10-27).
 * 마이 → 관리자 → "월간 갱신 요청문"에서 언제든 다시 열 수 있다
 */
export function AdminMonthlyNotice() {
  const me = useAuth((s) => (s.status === 'user' ? s.me : null));
  const today = todayIn('Asia/Seoul');
  const [open, setOpen] = useState(
    () => !!me?.isAdmin && shouldShowNotice(today, lastShown(), me.id),
  );
  if (!me?.isAdmin) return null;
  return (
    <MonthlyUpdateSheet
      open={open}
      month={today.slice(0, 7)}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) return;
        try {
          localStorage.setItem(KEY, today.slice(0, 7));
        } catch {
          // 저장 못 하면 이번 실행에서만 닫힌다
        }
      }}
    />
  );
}
