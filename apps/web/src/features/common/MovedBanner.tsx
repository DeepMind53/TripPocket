import { useTranslation } from '../../i18n';

const OLD_HOST = 'trippocket.pages.dev';
const NEW_ORIGIN = 'https://trippocket.day';

/**
 * 옛 주소(pages.dev)에서 열었을 때 맨 위 안내 (2026-10-24 주소 이전).
 * 설치된 앱은 저장된 화면으로 열려서 주소 이동(functions/_middleware.ts)을 거치지 않는다 → 여기서 알린다.
 * 기기 저장소는 주소마다 따로라 "이 기기에만 있는 여행"은 백업 → 새 주소에서 복원해야 한다
 */
export function MovedBanner({ host = window.location.hostname }: { host?: string }) {
  const { t } = useTranslation();
  if (host !== OLD_HOST) return null;
  const path = `${window.location.pathname}${window.location.search}`;
  return (
    <div role="alert" className="flex flex-col gap-2 bg-primary-weak px-5 py-3">
      <p className="text-caption font-semibold">{t('moved.title')}</p>
      <p className="text-caption text-fg-sub">{t('moved.desc')}</p>
      <div className="flex gap-2">
        <a
          href={`${NEW_ORIGIN}${path}`}
          className="inline-flex h-9 items-center rounded-btn bg-primary px-3 text-caption font-semibold text-on-primary"
        >
          {t('moved.open')}
        </a>
        <a
          href="/backup"
          className="inline-flex h-9 items-center rounded-btn bg-surface px-3 text-caption font-semibold"
        >
          {t('moved.backup')}
        </a>
      </div>
    </div>
  );
}
