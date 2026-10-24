import { useLimitNotice } from '../../data/limitNotice';
import { FallbackLinks } from './FallbackLinks';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button } from '../../shared/ui';

/**
 * 사용량 한도 안내 팝업 (사용자 요청 2026-10-24) — 서버가 한도로 거절하면 이유와 언제 풀리는지.
 * 이유는 data/limitNotice.ts가 받는다
 */
export function LimitNoticeSheet() {
  const { t } = useTranslation();
  const notice = useLimitNotice((s) => s.notice);
  const links = useLimitNotice((s) => s.links);
  const close = () => useLimitNotice.setState({ notice: null, links: [] });
  if (!notice) return null;

  const title = t('limit.title');
  const body =
    notice.kind === 'api_paused'
      ? t('limit.paused', {
          name: t(`apiUsage.name.${notice.api}` as 'apiUsage.name.groq'),
        })
      : notice.feature === 'ai'
        ? t('limit.ai', { n: notice.limit ?? 20 })
        : notice.feature === 'places_details'
          ? t('limit.details')
          : t('limit.search');
  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && close()}
      title={title}
      footer={
        <Button size="lg" fullWidth onClick={close}>
          {t('limit.ok')}
        </Button>
      }
    >
      <p className="text-body-1 text-fg-sub">{body}</p>
      {links.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-caption text-fg-muted">{t('fallback.instead')}</p>
          <FallbackLinks links={links} />
        </div>
      )}
    </BottomSheet>
  );
}
