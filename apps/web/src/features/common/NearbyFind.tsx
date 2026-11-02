import { useTranslation } from '../../i18n';

const KINDS = [
  { id: 'store', emoji: '🏪', google: 'convenience store', naver: '편의점' },
  { id: 'pharmacy', emoji: '💊', google: 'pharmacy', naver: '약국' },
  { id: 'atm', emoji: '🏧', google: 'ATM', naver: 'ATM' },
  { id: 'toilet', emoji: '🚻', google: 'public toilet', naver: '공중화장실' },
] as const;

/**
 * 실험실 "근처 찾기" (2026-11-03): 편의점·약국·ATM·화장실을 지도 앱 검색으로 바로 연다.
 * 위치는 지도 앱이 기기에서 쓰고, 앱·서버로는 보내지 않는다 (국내는 네이버 지도, 해외는 Google 지도)
 */
export function NearbyFind({ domestic }: { domestic: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded-card bg-bg-subtle px-3 py-2.5">
      <span className="text-caption font-semibold">{t('nearbyFind.title')}</span>
      <div className="grid grid-cols-4 gap-1.5">
        {KINDS.map((k) => (
          <a
            key={k.id}
            href={
              domestic
                ? `https://map.naver.com/p/search/${encodeURIComponent(k.naver)}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k.google)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-btn bg-surface text-caption font-semibold"
          >
            <span aria-hidden="true" className="text-body-1">
              {k.emoji}
            </span>
            {t(`nearbyFind.${k.id}`)}
          </a>
        ))}
      </div>
      <span className="text-micro text-fg-muted">{t('nearbyFind.note')}</span>
    </div>
  );
}
