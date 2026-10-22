import { Share, SquarePlus } from 'lucide-react';
import { inAppBrowser, platform, promptInstall, useInstall } from '../../app/pwa';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button } from '../../shared/ui';
import { OpenInBrowser } from '../common/InAppBanner';

/** S-42 설치 안내: 안드로이드 = 설치 버튼, 아이폰 = 공유 → 홈 화면에 추가, 앱 안 브라우저 = 다른 브라우저로 */
export function InstallSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { prompt, installed } = useInstall();
  const where = platform();
  const inApp = inAppBrowser();

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('pwa.installTitle')}>
      <div className="flex flex-col gap-4">
        <p className="text-body-2 text-fg-sub">{t('pwa.installWhy')}</p>
        {installed ? (
          <p className="text-body-2 font-semibold text-success">{t('pwa.installed')}</p>
        ) : inApp ? (
          <OpenInBrowser />
        ) : where === 'ios' ? (
          <ol className="flex flex-col gap-3 text-body-2">
            <li className="flex items-center gap-2">
              <span className="font-bold text-primary">1</span>
              {t('pwa.iosStep1')}
              <Share aria-hidden="true" className="size-5 text-primary" />
            </li>
            <li className="flex items-center gap-2">
              <span className="font-bold text-primary">2</span>
              {t('pwa.iosStep2')}
              <SquarePlus aria-hidden="true" className="size-5 text-primary" />
            </li>
            <li className="flex items-center gap-2">
              <span className="font-bold text-primary">3</span>
              {t('pwa.iosStep3')}
            </li>
          </ol>
        ) : prompt ? (
          <Button
            size="lg"
            fullWidth
            onClick={() =>
              void promptInstall().then((ok) => {
                if (ok) onOpenChange(false);
              })
            }
          >
            {t('pwa.install')}
          </Button>
        ) : (
          <p className="text-body-2">{t('pwa.installMenu')}</p>
        )}
      </div>
    </BottomSheet>
  );
}
