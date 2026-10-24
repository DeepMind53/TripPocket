import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';

/**
 * 인터넷이 끊기면 화면 맨 위 얇은 띠 (docs/16 F2). 다시 연결되면 "다시 연결됐어요"를 2초 보여 주고 사라진다
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [back, setBack] = useState(false);
  useEffect(() => {
    let timer = 0;
    const off = () => {
      setOnline(false);
      setBack(false);
    };
    const on = () => {
      setOnline(true);
      setBack(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBack(false), 2000);
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      window.clearTimeout(timer);
    };
  }, []);
  if (online && !back) return null;
  return (
    <p
      role="status"
      className={
        'sticky top-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-1 text-center text-caption font-semibold ' +
        (online ? 'bg-success text-white' : 'bg-fg text-bg')
      }
    >
      {online ? t('offline.back') : t('offline.banner')}
    </p>
  );
}
