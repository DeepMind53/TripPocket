import { Share, SquarePlus } from 'lucide-react';
import { inAppBrowser, platform, promptInstall, useInstall } from '../../app/pwa';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button } from '../../shared/ui';
import { OpenInBrowser } from '../common/InAppBanner';

/**
 * S-42 설치 안내: 안드로이드 = 설치 버튼, 아이폰 = 공유 → 홈 화면에 추가, 앱 안 브라우저 = 다른 브라우저로.
 * first = 처음 로그인한 뒤 한 번 (사용자 요청 2026-10-26): [확인]이 설치를 시작한다.
 * 브라우저 정책상 마지막 "설치" 확인은 브라우저 창에서 한 번 더 누르고, 아이폰은 직접 추가해야 한다
 */
export function InstallSheet({
  open,
  onOpenChange,
  first = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  first?: boolean;
}) {
  const { t } = useTranslation();
  const { prompt, installed } = useInstall();
  const where = platform();
  const inApp = inAppBrowser();

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('pwa.installTitle')}>
      <div className="flex flex-col gap-4">
        <p className="text-body-2 text-fg-sub">{t('pwa.installWhy')}</p>
        {installed && (
          <p className="text-body-2 font-semibold text-success">{t('pwa.installed')}</p>
        )}
        {/* 설치돼 있어도 방법은 보여 준다 — 다른 기기에 추가하거나 아이콘을 지웠을 때 */}
        {inApp ? (
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
            {first ? t('pwa.installConfirm') : t('pwa.install')}
          </Button>
        ) : (
          <p className="text-body-2">{t('pwa.installMenu')}</p>
        )}
        {first && (
          <Button
            size="lg"
            fullWidth
            variant={prompt && !inApp && where !== 'ios' ? 'ghost' : 'primary'}
            onClick={() => onOpenChange(false)}
          >
            {prompt && !inApp && where !== 'ios' ? t('pwa.installLater') : t('pwa.installConfirm')}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
