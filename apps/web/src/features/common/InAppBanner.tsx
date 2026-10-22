import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { inAppBrowser, platform } from '../../app/pwa';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { Button } from '../../shared/ui';

/** 앱 안 브라우저(카톡 등)에서 열었을 때 맨 위 안내 — 데이터가 사라질 수 있어서 */
export function InAppBanner() {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);
  if (hidden || !inAppBrowser()) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 bg-warning/15 px-5 py-3">
      <p className="text-caption font-semibold">{t('pwa.inAppWarn')}</p>
      <div className="flex gap-2">
        <OpenInBrowser compact />
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
          {t('backup.dismiss')}
        </Button>
      </div>
    </div>
  );
}

/** 다른 브라우저로 열기: 카톡은 외부 브라우저 열기 주소, 안드로이드는 크롬, 그 밖은 주소 복사 */
export function OpenInBrowser({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const url = window.location.href;
  const inApp = inAppBrowser();
  const href =
    inApp === 'kakao'
      ? `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
      : platform() === 'android'
        ? `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
        : null;
  return href ? (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-btn bg-primary font-semibold text-on-primary ${compact ? 'h-9 px-3 text-caption' : 'h-12 text-body-2'}`}
    >
      <ExternalLink aria-hidden="true" className="size-4" />
      {t('pwa.openBrowser')}
    </a>
  ) : (
    <Button size={compact ? 'sm' : 'lg'} onClick={() => void copyText(url, t('pwa.copied'))}>
      {t('pwa.copyLink')}
    </Button>
  );
}
