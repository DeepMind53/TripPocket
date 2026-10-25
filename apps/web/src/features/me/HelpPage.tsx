import { useTranslation } from '../../i18n';
import { TopBar } from '../../shared/ui';
import { IntroCarousel } from './IntroCarousel';

/** 홈 로고 옆 [도움말] → 로그인 화면의 앱 소개를 언제든 다시 (사용자 요청 2026-10-26) */
export function HelpPage() {
  const { t } = useTranslation();
  return (
    <>
      <TopBar title={t('help.title')} backTo="/" />
      <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
        <IntroCarousel />
      </div>
    </>
  );
}
