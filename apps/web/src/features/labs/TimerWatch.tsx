import { useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui/toastStore';
import { setTimer, useTimer } from './timerStore';

/**
 * 타이머가 끝나면 알림·진동·알림 줄 (빠른 메뉴 버튼과 함께 늘 떠 있는 작은 감시자 — 앱이 열려 있을 때만).
 * 앱을 닫은 사이 끝났으면 다시 열 때 알려 준다
 */
export function TimerWatch() {
  const { t } = useTranslation();
  const end = useTimer((s) => s.end);
  useEffect(() => {
    if (end === null) return;
    const fire = () => {
      setTimer(null);
      toast(t('tool.timerDone'));
      navigator.vibrate?.([300, 150, 300]);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification(t('tool.timerDone'));
    };
    const id = window.setTimeout(fire, Math.max(0, end - Date.now()));
    return () => window.clearTimeout(id);
  }, [end, t]);
  return null;
}
